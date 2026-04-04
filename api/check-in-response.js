// Vercel Serverless Function: Handle check-in email responses
// GET endpoint — freelancer clicks "Yes paid" or "No send chase" from email

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { friendlySubject, friendlyBody, legalSubject, legalBody } from './_toneModifiers.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function esc(text) {
  if (!text) return ''
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

let RATE = 11.75
let DAILY_RATE = RATE / 365 / 100

async function loadLiveRate() {
  try {
    const { fetchBoeRate } = await import('./boe-rate.js')
    const { rate } = await fetchBoeRate()
    RATE = 8 + rate
    DAILY_RATE = RATE / 365 / 100
  } catch {
    // Keep fallback
  }
}

const STAGE_ORDER = ['reminder_1', 'reminder_2', 'final_warning', 'first_chase', 'second_chase', 'third_chase', 'chase_4', 'chase_5', 'chase_6', 'chase_7', 'chase_8', 'chase_9', 'chase_10', 'chase_11', 'escalation_1', 'escalation_2', 'escalation_3', 'escalation_4', 'final_notice']

const STAGE_COLORS = {
  reminder_1: '#1e5fa0', reminder_2: '#2d72b8', final_warning: '#b45309',
  first_chase: '#d97706', second_chase: '#c2410c', third_chase: '#b91c1c',
  chase_4: '#9f1239', chase_5: '#9f1239', chase_6: '#9f1239', chase_7: '#9f1239',
  chase_8: '#9f1239', chase_9: '#9f1239', chase_10: '#9f1239', chase_11: '#9f1239',
  escalation_1: '#7f1d1d', escalation_2: '#7f1d1d', escalation_3: '#7f1d1d', escalation_4: '#7f1d1d',
  final_notice: '#7f1d1d',
}

function penalty(amount) {
  if (amount < 1000) return 40
  if (amount < 10000) return 70
  return 100
}

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysLate(due) {
  const d = Math.floor((Date.now() - new Date(due).getTime()) / 864e5)
  return d > 0 ? d : 0
}

function getNextStage(currentStage) {
  const idx = STAGE_ORDER.indexOf(currentStage)
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

function verifyToken(token, secret) {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sig] = parts
  const payload = Buffer.from(payloadB64, 'base64url').toString()
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  if (sig !== expectedSig) return null
  const data = JSON.parse(payload)
  if (data.exp < Date.now()) return null
  return data
}

function respondHtml(title, body, color = '#1e5fa0') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title} — Hielda</title>
</head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:${color};padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
      </div>
      <div style="padding:32px 24px;font-size:14px;line-height:1.7;color:#0f172a;text-align:center;">
        ${body}
      </div>
    </div>
    <div style="text-align:center;padding:16px;">
      <p style="font-size:12px;color:#94a3b8;margin:0 0 6px;">You can close this tab now.</p>
      <p style="font-size:11px;color:#bcc3ce;margin:0;">Hielda — Protecting your pay.</p>
    </div>
  </div>
</body>
</html>`
}

function buildChaseEmailHtml(invoice, profile, stage, dl, interest, pen, total, tone = 'firm') {
  const fromName = esc(profile.business_name || profile.full_name || 'Hielda')
  const color = STAGE_COLORS[stage] || '#1e5fa0'
  const poRef = invoice.client_ref ? ` (${esc(invoice.client_ref)})` : ''
  // Escape user-controlled fields used in templates
  invoice = { ...invoice, client_name: esc(invoice.client_name), ref: esc(invoice.ref) }

  const payBlock = `
    <div style="background:#f1f3f6;padding:14px 18px;border-radius:8px;margin:16px 0;font-size:13px;">
      <div style="font-weight:600;color:#0f172a;margin-bottom:6px;">Payment Details</div>
      <div style="color:#64748b;">
        Account Name: ${esc(profile.account_name) || '—'}<br/>
        Bank: ${esc(profile.bank_name) || '—'}<br/>
        Sort Code: ${esc(profile.sort_code) || '—'}<br/>
        Account: ${esc(profile.account_number) || '—'}<br/>
        Reference: ${invoice.ref}
      </div>
    </div>`

  const subjects = {
    reminder_1: `Payment reminder: Invoice ${invoice.ref} — ${fmt(invoice.amount)}`,
    reminder_2: `Upcoming: Invoice ${invoice.ref} due tomorrow — ${fmt(invoice.amount)}`,
    first_chase: `OVERDUE: Invoice ${invoice.ref} — payment required`,
    second_chase: `OVERDUE: Invoice ${invoice.ref} — ${fmt(total)} now owed (interest applied)`,
    final_notice: `FINAL NOTICE: Invoice ${invoice.ref} — ${fmt(total)} overdue. Legal action pending.`,
  }

  const bodies = {
    reminder_1: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is a friendly reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due by <strong>${formatDate(invoice.due_date)}</strong>.</p>
      <p>Please ensure payment is made by the due date to avoid any late payment charges.</p>
      ${payBlock}
      <p>If you've already made payment, please disregard this message.</p>
      <p>Kind regards,<br/>${fromName}</p>`,
    reminder_2: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is a reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due <strong>tomorrow</strong> (${formatDate(invoice.due_date)}).</p>
      <p>Under the Late Payment of Commercial Debts (Interest) Act 1998, interest and penalties will be applied if payment is not received by the due date.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>`,
    first_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> was due by <strong>${formatDate(invoice.due_date)}</strong> and remains unpaid.</p>
      <p>Under the Late Payment of Commercial Debts (Interest) Act 1998, we are entitled to charge interest at <strong>${RATE}% per annum</strong> and a fixed penalty. Interest is now accruing on this debt.</p>
      <p>Please arrange payment immediately.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    second_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong>. Under the Late Payment of Commercial Debts (Interest) Act 1998, the following charges have been applied:</p>
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Original invoice</td><td style="padding:6px 0;font-weight:600;">${fmt(invoice.amount)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Fixed penalty</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(pen)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Interest (${dl} days at ${RATE}% p.a.)</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(interest)}</td></tr>
        <tr style="border-top:2px solid #1e5fa0;"><td style="padding:10px 16px 6px 0;font-weight:700;">TOTAL NOW OWED</td><td style="padding:10px 0 6px;font-weight:700;font-size:16px;color:#1e5fa0;">${fmt(total)}</td></tr>
      </table>
      <p>Please settle this amount immediately to prevent further charges.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    final_notice: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>This is a final notice before we consider further action.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong>. Despite previous communications, payment has not been received.</p>
      <p>The total amount now owed, including statutory interest and penalties under the Late Payment of Commercial Debts (Interest) Act 1998, is:</p>
      <div style="background:#fef2f2;border-left:4px solid #9f1239;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
        <div style="font-size:12px;color:#9f1239;font-weight:600;margin-bottom:4px;">TOTAL NOW OWED</div>
        <div style="font-size:24px;font-weight:700;color:#9f1239;">${fmt(total)}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">Original: ${fmt(invoice.amount)} + Penalty: ${fmt(pen)} + Interest: ${fmt(interest)}</div>
      </div>
      <p>If payment is not received within <strong>7 days</strong>, we will have no choice but to pursue this debt through formal channels, which may include referral to a debt recovery agency or legal proceedings.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
  }

  // Build shared blocks for tone modifiers
  const lineBlock = ''
  const interestTable = `
    <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Original invoice</td><td style="padding:6px 0;font-weight:600;">${fmt(invoice.amount)}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Fixed penalty</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(pen)}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Interest (${dl} days at ${RATE}% p.a.)</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(interest)}</td></tr>
      <tr style="border-top:2px solid #1e5fa0;"><td style="padding:10px 16px 6px 0;font-weight:700;">TOTAL NOW OWED</td><td style="padding:10px 0 6px;font-weight:700;font-size:16px;color:#1e5fa0;">${fmt(total)}</td></tr>
    </table>`
  const totalBlock = `
    <div style="background:#fef2f2;border-left:4px solid #9f1239;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
      <div style="font-size:12px;color:#9f1239;font-weight:600;margin-bottom:4px;">TOTAL NOW OWED</div>
      <div style="font-size:24px;font-weight:700;color:#9f1239;">${fmt(total)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Original: ${fmt(invoice.amount)} + Penalty: ${fmt(pen)} + Interest: ${fmt(interest)}</div>
    </div>`

  const toneCtx = {
    invoice, profile, dl, total, interest, pen, fromName, poRef,
    interestTable, totalBlock, lineBlock, payBlock,
  }

  let subject, body
  if (tone === 'friendly') {
    subject = friendlySubject(stage, toneCtx)
    body = friendlyBody(stage, toneCtx)
  } else if (tone === 'legal') {
    subject = legalSubject(stage, toneCtx)
    body = legalBody(stage, toneCtx)
  } else {
    subject = subjects[stage] || subjects.first_chase
    body = bodies[stage] || bodies.first_chase
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:${color};padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
      </div>
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
        ${body}
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
      Sent via Hielda — Protecting your pay.
    </div>
  </div>
</body>
</html>`

  return { subject, html, fromName }
}

export default async function handler(req, res) {
  // GET endpoint — email links are GET
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed')
  }

  // Load live BoE rate before calculating
  await loadLiveRate()

  try {
    const { action, invoice_id, stage, token } = req.query

    if (!token || !invoice_id || !action) {
      return res.status(400).setHeader('Content-Type', 'text/html').send(
        respondHtml('Invalid Link', `
          <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
          <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Invalid Link</h2>
          <p style="color:#64748b;margin:0;">This link is missing required parameters. Please try again from your email.</p>
        `, '#94a3b8')
      )
    }

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).setHeader('Content-Type', 'text/html').send(
        respondHtml('Server Error', `
          <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
          <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Server Error</h2>
          <p style="color:#64748b;margin:0;">The server is not properly configured. Please contact support.</p>
        `, '#9f1239')
      )
    }

    // Verify the HMAC token
    const tokenData = verifyToken(token, SUPABASE_SERVICE_KEY)

    if (!tokenData) {
      return res.status(403).setHeader('Content-Type', 'text/html').send(
        respondHtml('Link Expired', `
          <div style="font-size:36px;margin-bottom:16px;">&#9200;</div>
          <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">This link has expired</h2>
          <p style="color:#64748b;margin:0 0 20px;">Check-in links are valid for 7 days. Please check your Hielda dashboard to take action.</p>
          <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
        `, '#94a3b8')
      )
    }

    // Verify token matches the invoice
    if (tokenData.invoice_id !== invoice_id) {
      return res.status(403).setHeader('Content-Type', 'text/html').send(
        respondHtml('Invalid Link', `
          <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
          <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Invalid Link</h2>
          <p style="color:#64748b;margin:0;">This link doesn't match the expected invoice. Please try again from your email.</p>
        `, '#9f1239')
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single()

    if (invErr || !invoice) {
      return res.status(404).setHeader('Content-Type', 'text/html').send(
        respondHtml('Invoice Not Found', `
          <div style="font-size:36px;margin-bottom:16px;">&#128269;</div>
          <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Invoice Not Found</h2>
          <p style="color:#64748b;margin:0 0 20px;">This invoice may have been deleted.</p>
          <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
        `, '#94a3b8')
      )
    }

    // ── ACTION: PAID ──
    if (action === 'paid') {
      // Check if already marked paid
      if (invoice.status === 'paid') {
        return res.status(200).setHeader('Content-Type', 'text/html').send(
          respondHtml('Already Paid', `
            <div style="font-size:48px;margin-bottom:16px;color:#16a34a;">&#10003;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#16a34a;">Already Marked as Paid</h2>
            <p style="color:#64748b;margin:0 0 4px;">Invoice <strong>${invoice.ref}</strong> was already marked as paid.</p>
            <p style="color:#94a3b8;font-size:12px;margin:0 0 20px;">No further chase emails will be sent.</p>
            <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
          `, '#16a34a')
        )
      }

      // Mark as paid
      await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
          chase_stage: null,
          auto_chase: false,
        })
        .eq('id', invoice_id)

      // Log the action
      await supabase.from('chase_log').insert({
        invoice_id,
        user_id: invoice.user_id,
        chase_stage: tokenData.chase_stage || invoice.chase_stage,
        email_to: invoice.client_email,
        status: 'marked_paid_via_check_in',
      })

      return res.status(200).setHeader('Content-Type', 'text/html').send(
        respondHtml('Invoice Paid', `
          <div style="font-size:48px;margin-bottom:16px;color:#16a34a;">&#10003;</div>
          <h2 style="margin:0 0 8px;font-size:18px;color:#16a34a;">Invoice Marked as Paid</h2>
          <p style="color:#0f172a;margin:0 0 4px;">Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong></p>
          <p style="color:#64748b;margin:0 0 4px;">Client: ${invoice.client_name}</p>
          <p style="color:#16a34a;font-weight:600;margin:0 0 20px;">No chase email will be sent. Thank you!</p>
          <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
        `, '#16a34a')
      )
    }

    // ── ACTION: SKIP (don't chase this invoice) ──
    if (action === 'skip') {
      // Turn off auto-chase so the system stops sending check-ins
      await supabase
        .from('invoices')
        .update({ auto_chase: false })
        .eq('id', invoice_id)

      // Log the skip
      await supabase.from('chase_log').insert({
        invoice_id,
        user_id: invoice.user_id,
        chase_stage: invoice.chase_stage,
        email_to: invoice.client_email,
        status: 'skipped_via_check_in',
      })

      return res.status(200).setHeader('Content-Type', 'text/html').send(
        respondHtml('Chasing Paused', `
          <div style="font-size:48px;margin-bottom:16px;color:#64748b;">&#10074;&#10074;</div>
          <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Automatic Chasing Paused</h2>
          <p style="color:#0f172a;margin:0 0 4px;">Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong></p>
          <p style="color:#64748b;margin:0 0 4px;">Client: ${invoice.client_name}</p>
          <p style="color:#64748b;margin:0 0 20px;">No chase email will be sent. You can turn automatic chasing back on from your dashboard at any time.</p>
          <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
        `, '#64748b')
      )
    }

    // ── ACTION: CHASE ──
    if (action === 'chase') {
      // Use the invoice's current chase_stage from DB (most up-to-date),
      // falling back to the stage encoded in the check-in link
      const chaseStage = invoice.chase_stage || stage || tokenData.chase_stage || 'first_chase'

      // Fetch profile for the chase email
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', invoice.user_id)
        .single()

      if (profErr || !profile) {
        return res.status(404).setHeader('Content-Type', 'text/html').send(
          respondHtml('Profile Not Found', `
            <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Profile Not Found</h2>
            <p style="color:#64748b;margin:0 0 20px;">Could not find your business profile. Please check your Hielda settings.</p>
            <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
          `, '#9f1239')
        )
      }

      if (!invoice.client_email) {
        return res.status(400).setHeader('Content-Type', 'text/html').send(
          respondHtml('No Client Email', `
            <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">No Client Email</h2>
            <p style="color:#64748b;margin:0 0 20px;">This invoice doesn't have a client email address. Please update it in your dashboard.</p>
            <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
          `, '#d97706')
        )
      }

      // Subscription check: ensure user has active subscription before sending chase
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, trial_end')
        .eq('user_id', invoice.user_id)
        .single()

      if (sub) {
        const isActive = sub.status === 'active' ||
          (sub.status === 'trialing' && new Date(sub.trial_end) > new Date())
        if (!isActive) {
          return res.status(403).setHeader('Content-Type', 'text/html').send(
            respondHtml('Subscription Expired', `
              <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
              <h2 style="margin:0 0 8px;font-size:18px;color:#d97706;">Subscription Expired</h2>
              <p style="color:#64748b;margin:0 0 20px;">Your Hielda subscription has expired. Please renew to continue sending chase emails.</p>
              <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
            `, '#d97706')
          )
        }
      }

      // Guard: if invoice was already paid or chase paused, don't send
      if (invoice.status === 'paid') {
        return res.status(200).setHeader('Content-Type', 'text/html').send(
          respondHtml('Already Paid', `
            <div style="font-size:48px;margin-bottom:16px;color:#16a34a;">&#10003;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#16a34a;">Already Marked as Paid</h2>
            <p style="color:#64748b;margin:0 0 20px;">Invoice <strong>${invoice.ref}</strong> was already marked as paid. No chase sent.</p>
            <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
          `, '#16a34a')
        )
      }

      // Build and send the chase email to the client (respect no_fines flag)
      const dl = daysLate(invoice.due_date)
      const finesEnabled = !invoice.no_fines
      const interest = finesEnabled ? Math.round(Number(invoice.amount) * DAILY_RATE * dl * 100) / 100 : 0
      const pen = finesEnabled ? penalty(Number(invoice.amount)) : 0
      const total = Math.round((Number(invoice.amount) + interest + pen) * 100) / 100

      const tone = profile.chase_tone || 'firm'
      const email = buildChaseEmailHtml(invoice, profile, chaseStage, dl, interest, pen, total, tone)

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${email.fromName} via Hielda <chase@hielda.com>`,
          reply_to: profile.email,
          to: [invoice.client_email],
          subject: email.subject,
          html: email.html,
          headers: { 'List-Unsubscribe': `<mailto:unsubscribe@hielda.com?subject=Unsubscribe%20${invoice.ref}>` },
        }),
      })

      const resendData = await resendRes.json()

      if (!resendRes.ok) {
        return res.status(500).setHeader('Content-Type', 'text/html').send(
          respondHtml('Send Failed', `
            <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#9f1239;">Failed to Send Chase Email</h2>
            <p style="color:#64748b;margin:0 0 20px;">${resendData.message || 'An error occurred while sending the email. Please try again from your dashboard.'}</p>
            <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
          `, '#9f1239')
        )
      }

      // Log the chase send
      await supabase.from('chase_log').insert({
        invoice_id,
        user_id: invoice.user_id,
        chase_stage: chaseStage,
        email_to: invoice.client_email,
        status: 'sent',
      })

      // Advance invoice chase_stage to the next stage
      const nextStage = getNextStage(chaseStage)
      await supabase
        .from('invoices')
        .update({ chase_stage: nextStage || chaseStage })
        .eq('id', invoice_id)

      const stageColor = STAGE_COLORS[chaseStage] || '#1e5fa0'

      return res.status(200).setHeader('Content-Type', 'text/html').send(
        respondHtml('Chase Sent', `
          <div style="font-size:48px;margin-bottom:16px;color:${stageColor};">&#9993;</div>
          <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Chase Email Sent</h2>
          <p style="color:#0f172a;margin:0 0 4px;">Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong></p>
          <p style="color:#64748b;margin:0 0 20px;">Chase email sent to <strong>${invoice.client_name}</strong> at <strong>${invoice.client_email}</strong></p>
          <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
        `, stageColor)
      )
    }

    // Unknown action
    return res.status(400).setHeader('Content-Type', 'text/html').send(
      respondHtml('Invalid Action', `
        <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
        <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Invalid Action</h2>
        <p style="color:#64748b;margin:0 0 20px;">The action "${action}" is not recognised. Please try again from your email.</p>
        <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
      `, '#94a3b8')
    )
  } catch (e) {
    return res.status(500).setHeader('Content-Type', 'text/html').send(
      respondHtml('Error', `
        <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
        <h2 style="margin:0 0 8px;font-size:18px;color:#9f1239;">Something went wrong</h2>
        <p style="color:#64748b;margin:0 0 20px;">An unexpected error occurred. Please try again or check your dashboard.</p>
        <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
      `, '#9f1239')
    )
  }
}
