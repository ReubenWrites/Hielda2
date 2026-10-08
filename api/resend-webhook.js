// Vercel Serverless Function: Resend webhook handler
// Receives delivery events (delivered, bounced, complained, opened, ...)
// from Resend and updates chase_log delivery_status / calculator_leads
// engagement accordingly.
//
// Every call is recorded in webhook_log (migration 028) with the outcome,
// because Resend disabled this endpoint for "repeatedly failing" and
// neither Resend (paid feature) nor Vercel Hobby (no retention) keeps
// logs we can read. Logging is best-effort and never changes the response.

import { Webhook } from 'svix'
import { createClient } from '@supabase/supabase-js'

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY

// Map Resend event types to our delivery_status values
const STATUS_MAP = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'delayed',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
}

export const config = {
  api: { bodyParser: false }, // Need raw body for signature verification
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null
  const record = { event_type: null, email_id: null }

  // One exit path: log, then respond. Logging failures are swallowed so a
  // missing table can never turn a good event into a failed delivery.
  const finish = async (status, outcome, detail, body) => {
    if (supabase) {
      try {
        await supabase.from('webhook_log').insert({
          event_type: record.event_type,
          email_id: record.email_id,
          outcome,
          detail: detail ? String(detail).slice(0, 500) : null,
          status,
        })
      } catch {}
    }
    return res.status(status).json(body || { received: outcome === 'ok' || outcome === 'ignored', outcome })
  }

  if (!RESEND_WEBHOOK_SECRET || !supabase) {
    const missing = [!RESEND_WEBHOOK_SECRET && 'RESEND_WEBHOOK_SECRET', !SUPABASE_URL && 'VITE_SUPABASE_URL', !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean).join(', ')
    return finish(500, 'not_configured', `missing env: ${missing}`, { error: 'Server not configured' })
  }

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req)
    const payload = rawBody.toString()

    // Best-effort peek at the event so a rejected call is still identifiable.
    try {
      const peek = JSON.parse(payload)
      record.event_type = peek?.type || null
      record.email_id = peek?.data?.email_id || null
    } catch {}

    // Verify webhook signature using Svix
    const wh = new Webhook(RESEND_WEBHOOK_SECRET)
    let event
    try {
      event = wh.verify(payload, {
        'svix-id': req.headers['svix-id'],
        'svix-timestamp': req.headers['svix-timestamp'],
        'svix-signature': req.headers['svix-signature'],
      })
    } catch (e) {
      const hdrs = ['svix-id', 'svix-timestamp', 'svix-signature'].filter((h) => !req.headers[h])
      return finish(400, 'bad_signature', hdrs.length ? `missing headers: ${hdrs.join(', ')}` : e?.message, { error: 'Invalid webhook signature' })
    }

    record.event_type = event.type
    const deliveryStatus = STATUS_MAP[event.type]
    if (!deliveryStatus) {
      // Event type we don't care about — acknowledge and ignore
      return finish(200, 'ignored', 'unhandled event type')
    }

    const resendEmailId = event.data?.email_id
    record.email_id = resendEmailId || null
    if (!resendEmailId) {
      return finish(200, 'ignored', 'no email_id in event')
    }

    // ── Lead drip emails ──────────────────────────────────────────────
    // Sends from api/lead-drip.js and api/calculator-lead.js are tagged
    // `lead_drip`. Opens/clicks feed the engagement-adaptive cadence:
    // leads who open get the faster interval and the discount email.
    // Resend delivers tags as either an object map or an array of
    // {name, value} — handle both.
    const rawTags = event.data?.tags
    const tagType = Array.isArray(rawTags)
      ? rawTags.find((t) => t?.name === 'type')?.value
      : rawTags?.type
    if (tagType === 'lead_drip') {
      if (deliveryStatus === 'opened' || deliveryStatus === 'clicked') {
        const { data: lead } = await supabase
          .from('calculator_leads')
          .select('id, opened_count, last_opened_at, last_email_at')
          .eq('last_email_id', resendEmailId)
          .maybeSingle()
        if (lead) {
          // Count each email's open once — Resend fires an event per
          // render, and one enthusiastic re-reader shouldn't look like
          // five engaged leads.
          const alreadyCounted =
            lead.last_opened_at && lead.last_email_at &&
            new Date(lead.last_opened_at) >= new Date(lead.last_email_at)
          await supabase
            .from('calculator_leads')
            .update({
              last_opened_at: new Date().toISOString(),
              ...(alreadyCounted ? {} : { opened_count: (lead.opened_count || 0) + 1 }),
            })
            .eq('id', lead.id)
        }
        return finish(200, 'ok', `lead_drip ${deliveryStatus}: ${lead ? 'lead updated' : 'no matching lead'}`)
      }
      if (deliveryStatus === 'bounced' || deliveryStatus === 'complained') {
        // Hard bounce or spam complaint: stop the sequence permanently.
        await supabase
          .from('calculator_leads')
          .update({ unsubscribed: true })
          .eq('last_email_id', resendEmailId)
        return finish(200, 'ok', `lead_drip ${deliveryStatus}: lead unsubscribed`)
      }
      return finish(200, 'ok', `lead_drip ${deliveryStatus}: nothing to do`)
    }

    // ── Chase emails (invoice-related) ────────────────────────────────
    // Update the matching chase_log entry. A resend_id is unique per send,
    // but take the first row defensively rather than erroring on duplicates.
    const { data: logRows, error: logErr } = await supabase
      .from('chase_log')
      .update({ delivery_status: deliveryStatus })
      .eq('resend_id', resendEmailId)
      .select('id, invoice_id, user_id, chase_stage, email_to')
    if (logErr) return finish(500, 'error', `chase_log update: ${logErr.message}`, { error: logErr.message })
    const logEntry = logRows?.[0]
    if (!logEntry) return finish(200, 'ok', `${deliveryStatus}: no chase_log row with this resend_id`)

    let detail = `${deliveryStatus}: chase_log ${logEntry.id} updated`

    // Insert in-app notification for actionable events
    if (deliveryStatus === 'bounced' || deliveryStatus === 'complained' || deliveryStatus === 'opened') {
      const { data: notifInvoice } = await supabase
        .from('invoices')
        .select('ref')
        .eq('id', logEntry.invoice_id)
        .maybeSingle()

      const notifType = deliveryStatus === 'complained' ? 'complaint' : deliveryStatus === 'bounced' ? 'bounce' : 'opened'

      // Only notify once per event type per chase log entry.
      // (chase_log_id is a FK to chase_log.id; this used to be given the
      // invoice id, which violated the FK and silently dropped every insert.)
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('chase_log_id', logEntry.id)
        .eq('type', notifType)
        .maybeSingle()

      if (!existingNotif && notifInvoice) {
        const notifMap = {
          bounce: { title: `Email bounced — ${notifInvoice.ref}`, body: `Chase email to ${logEntry.email_to} failed to deliver.` },
          complaint: { title: `Marked as spam — ${notifInvoice.ref}`, body: `${logEntry.email_to} marked your chase email as spam.` },
          opened: { title: `Email opened — ${notifInvoice.ref}`, body: `${logEntry.email_to} opened your chase email.` },
        }
        const notif = notifMap[notifType]
        const { error: notifErr } = await supabase.from('notifications').insert({
          user_id: logEntry.user_id,
          type: notifType,
          title: notif.title,
          body: notif.body,
          invoice_id: logEntry.invoice_id,
          chase_log_id: logEntry.id,
        })
        detail += notifErr ? `; notification failed: ${notifErr.message}` : '; notification created'
      }
    }

    // If the email bounced or was complained about, also send email notification to freelancer
    if (deliveryStatus === 'bounced' || deliveryStatus === 'complained') {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('ref, client_name')
        .eq('id', logEntry.invoice_id)
        .maybeSingle()

      const { data: { user } = {} } = await supabase.auth.admin.getUserById(logEntry.user_id)

      if (user?.email && invoice && RESEND_API_KEY) {
        const isComplaint = deliveryStatus === 'complained'
        const subject = isComplaint
          ? `⚠️ Email marked as spam — Invoice ${invoice.ref}`
          : `⚠️ Email delivery failed — Invoice ${invoice.ref}`

        const body = isComplaint
          ? `<p>Hi,</p>
             <p>A chase email sent to <strong>${logEntry.email_to}</strong> for invoice <strong>${invoice.ref}</strong> (${invoice.client_name}) was marked as spam by the recipient.</p>
             <p>You may want to contact ${invoice.client_name} directly to resolve this.</p>`
          : `<p>Hi,</p>
             <p>A chase email sent to <strong>${logEntry.email_to}</strong> for invoice <strong>${invoice.ref}</strong> (${invoice.client_name}) failed to deliver — the address may be incorrect or the inbox full.</p>
             <p>Please check the email address and consider contacting ${invoice.client_name} directly.</p>`

        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Hielda <notifications@hielda.com>',
            to: [user.email],
            subject,
            html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;font-size:14px;color:#0f172a;line-height:1.7;">
              ${body}
              <p>Log in to <a href="https://hielda.com">Hielda</a> to view the invoice.</p>
            </body></html>`,
          }),
        })
        detail += r.ok ? '; owner emailed' : `; owner email failed (${r.status})`
      }
    }

    return finish(200, 'ok', detail, { received: true, status: deliveryStatus })
  } catch (e) {
    return finish(500, 'error', e?.stack || e?.message, { error: e.message })
  }
}
