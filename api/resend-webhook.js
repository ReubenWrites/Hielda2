// Vercel Serverless Function: Resend webhook handler
// Receives delivery events (delivered, bounced, complained, failed) from Resend
// and updates chase_log delivery_status accordingly.

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

  if (!RESEND_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req)
    const payload = rawBody.toString()

    // Verify webhook signature using Svix
    const wh = new Webhook(RESEND_WEBHOOK_SECRET)
    let event
    try {
      event = wh.verify(payload, {
        'svix-id': req.headers['svix-id'],
        'svix-timestamp': req.headers['svix-timestamp'],
        'svix-signature': req.headers['svix-signature'],
      })
    } catch {
      return res.status(400).json({ error: 'Invalid webhook signature' })
    }

    const deliveryStatus = STATUS_MAP[event.type]
    if (!deliveryStatus) {
      // Event type we don't care about — acknowledge and ignore
      return res.status(200).json({ received: true })
    }

    const resendEmailId = event.data?.email_id
    if (!resendEmailId) {
      return res.status(200).json({ received: true })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Update the matching chase_log entry
    const { data: logEntry } = await supabase
      .from('chase_log')
      .update({ delivery_status: deliveryStatus })
      .eq('resend_id', resendEmailId)
      .select('invoice_id, user_id, chase_stage, email_to')
      .single()

    // If the email bounced or was complained about, notify the freelancer
    if ((deliveryStatus === 'bounced' || deliveryStatus === 'complained') && logEntry) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('ref, client_name')
        .eq('id', logEntry.invoice_id)
        .single()

      const { data: { user } } = await supabase.auth.admin.getUserById(logEntry.user_id)

      if (user?.email && invoice) {
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

        await fetch('https://api.resend.com/emails', {
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
      }
    }

    return res.status(200).json({ received: true, status: deliveryStatus })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
