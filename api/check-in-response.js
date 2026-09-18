// Vercel Serverless Function: Handle check-in email responses
// GET endpoint — freelancer clicks "Yes paid" or "No send chase" from email

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { getInvoicePdfAttachment } from './_invoicePdfAttachment.js'
import { friendlySubject, friendlyBody, legalSubject, legalBody, firmSubject, firmBody, plainSubject, plainBody } from './_toneModifiers.js'
import { accruedInterest, fetchLedgers } from './_money.js'
import { clientSendBlock } from './_sendGuard.js'

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

// Mirrors src/constants.js. Past day 30 the stages are generated monthly
// rather than listed, so there is always a next one.
const STAGE_ORDER = [
  'reminder_1', 'reminder_2', 'final_warning', 'first_chase', 'second_chase',
  'third_chase', 'chase_4', 'final_notice',
]

const STAGE_COLORS = {
  reminder_1: '#1e5fa0', reminder_2: '#2d72b8', final_warning: '#b45309',
  first_chase: '#d97706', second_chase: '#c2410c', third_chase: '#b91c1c',
  chase_4: '#9f1239', chase_5: '#9f1239', chase_6: '#9f1239', chase_7: '#9f1239',
  chase_8: '#9f1239', chase_9: '#9f1239', chase_10: '#9f1239', chase_11: '#9f1239',
  escalation_1: '#7f1d1d', escalation_2: '#7f1d1d', escalation_3: '#7f1d1d', escalation_4: '#7f1d1d',
  final_notice: '#7f1d1d',
  recovery_1: '#450a0a', recovery_2: '#450a0a', recovery_3: '#450a0a', recovery_4: '#450a0a',
  recovery_5: '#27272a', recovery_6: '#27272a', recovery_7: '#27272a', recovery_8: '#27272a',
  recovery_9: '#27272a', recovery_10: '#27272a', recovery_11: '#27272a', recovery_final: '#18181b',
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
  const m = /^formal_(\d+)$/.exec(currentStage || '')
  if (m) return `formal_${Number(m[1]) + 1}`
  const idx = STAGE_ORDER.indexOf(currentStage)
  if (idx === -1) return null
  // After the last informal chase comes the first monthly formal reminder.
  if (idx >= STAGE_ORDER.length - 1) return 'formal_1'
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

function buildChaseEmailHtml(invoice, profile, stage, dl, interest, pen, total, tone = 'firm', finesEnabled = true) {
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


  // Build shared blocks for tone modifiers
  const lineBlock = ''
  const interestTable = `
    <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Original invoice</td><td style="padding:6px 0;font-weight:600;">${fmt(invoice.amount)}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Fixed debt recovery cost</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(pen)}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Interest (${dl} days at ${RATE}% p.a.)</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(interest)}</td></tr>
      <tr style="border-top:2px solid #1e5fa0;"><td style="padding:10px 16px 6px 0;font-weight:700;">TOTAL NOW OWED</td><td style="padding:10px 0 6px;font-weight:700;font-size:16px;color:#1e5fa0;">${fmt(total)}</td></tr>
    </table>`
  const totalBlock = `
    <div style="background:#fef2f2;border-left:4px solid #9f1239;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
      <div style="font-size:12px;color:#9f1239;font-weight:600;margin-bottom:4px;">TOTAL NOW OWED</div>
      <div style="font-size:24px;font-weight:700;color:#9f1239;">${fmt(total)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Original: ${fmt(invoice.amount)} + Debt recovery cost: ${fmt(pen)} + Interest: ${fmt(interest)}</div>
    </div>`

  const toneCtx = {
    invoice, profile, dl, total, interest, pen, fromName, poRef,
    interestTable, totalBlock, lineBlock, payBlock,
  }

  let subject, body
  if (!finesEnabled) {
    // Consumer client, or fines waived: the toned templates all cite the
    // 1998 Act and a fixed recovery fee, neither of which applies.
    subject = plainSubject(stage, toneCtx)
    body = plainBody(stage, toneCtx)
  } else if (tone === 'friendly') {
    subject = friendlySubject(stage, toneCtx)
    body = friendlyBody(stage, toneCtx)
  } else if (tone === 'legal') {
    subject = legalSubject(stage, toneCtx)
    body = legalBody(stage, toneCtx)
  } else {
    subject = firmSubject(stage, toneCtx)
    body = firmBody(stage, toneCtx)
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

/**
 * Approve one chase covering every overdue invoice a client has.
 *
 * Reuses the consolidated statement builder in chase mode, so the email is
 * itemised per invoice with the same interest engine, the same payment
 * history and the same combined total the user sees in the app.
 */
async function handleGroupChase(req, res, { invoice_ids, stage, token }) {
  const html = (title, body, color) =>
    res.status(200).setHeader('Content-Type', 'text/html').send(respondHtml(title, body, color))

  const tokenData = verifyToken(token, SUPABASE_SERVICE_KEY)
  if (!tokenData) {
    return html('Link Expired', `
      <div style="font-size:36px;margin-bottom:16px;">&#9200;</div>
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">This link has expired</h2>
      <p style="color:#64748b;margin:0 0 20px;">Check-in links are valid for 7 days. Please use your dashboard instead.</p>
      <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
    `, '#94a3b8')
  }

  const ids = String(invoice_ids).split(',').filter(Boolean)
  const signed = Array.isArray(tokenData.invoice_ids) ? tokenData.invoice_ids : []
  // Every requested id must be in the signed set, and vice versa: the token
  // is the authority on what was approved.
  const sameSet = ids.length === signed.length && ids.every((id) => signed.includes(id))
  if (!sameSet) {
    return html('Invalid Link', `
      <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Invalid Link</h2>
      <p style="color:#64748b;margin:0;">This link doesn't match the invoices it was issued for.</p>
    `, '#9f1239')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const chaseStage = tokenData.chase_stage || stage || 'first_chase'

  const { data: invoices } = await supabase.from('invoices').select('*').in('id', ids)
  if (!invoices || invoices.length === 0) {
    return html('Invoices Not Found', `
      <div style="font-size:36px;margin-bottom:16px;">&#128269;</div>
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Invoices not found</h2>
    `, '#94a3b8')
  }

  // Anything settled, parked, disputed, switched off or inside a Letter
  // Before Action window since the check-in went out drops out — the same
  // guard every client-facing send uses.
  let open = invoices.filter((i) => !clientSendBlock(i, 'chase'))
  if (open.length === 0) {
    return html('Nothing to Chase', `
      <div style="font-size:48px;margin-bottom:16px;color:#16a34a;">&#10004;</div>
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Nothing left to chase</h2>
      <p style="color:#64748b;margin:0 0 20px;">These invoices have been settled or paused since we asked. No email was sent.</p>
      <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
    `, '#16a34a')
  }

  // Dedupe against a double click or a mail client prefetching the link.
  // Per invoice, not per group: if one invoice's chase went out on an
  // earlier attempt, the rest must still be sent rather than the whole
  // group being reported as done.
  const { data: already } = await supabase
    .from('chase_log').select('invoice_id')
    .in('invoice_id', open.map((i) => i.id))
    .eq('chase_stage', chaseStage).eq('status', 'sent')
  const alreadySent = new Set((already || []).map((r) => r.invoice_id))
  open = open.filter((i) => !alreadySent.has(i.id))
  if (open.length === 0) {
    return html('Already Sent', `
      <div style="font-size:48px;margin-bottom:16px;color:#1e5fa0;">&#9993;</div>
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Chase already sent</h2>
      <p style="color:#94a3b8;font-size:12px;margin:0 0 20px;">No duplicate email was sent.</p>
      <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
    `, '#1e5fa0')
  }

  const clientName = open[0].client_name || 'your client'
  const clientEmail = open[0].client_email

  // GET shows a confirmation button. Mail clients prefetch links, and a
  // prefetch must never send a client-facing email.
  if (req.method !== 'POST') {
    return html('Confirm', `
      <div style="font-size:36px;margin-bottom:16px;color:#1e5fa0;">&#9993;</div>
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Send one chase for ${open.length} invoices?</h2>
      <p style="color:#64748b;margin:0 0 18px;">It will go to <strong>${clientName}</strong> itemising each invoice and the combined total.</p>
      <form method="POST" action="/api/check-in-response?action=chase&invoice_ids=${encodeURIComponent(ids.join(','))}&stage=${encodeURIComponent(chaseStage)}&token=${encodeURIComponent(token)}">
        <button type="submit" style="padding:12px 28px;background:#1e5fa0;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer;">Yes, send it</button>
      </form>
    `, '#1e5fa0')
  }

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', open[0].user_id).single()
  if (!profile) {
    return html('Profile Not Found', '<p style="color:#64748b;">Could not load your details.</p>', '#9f1239')
  }

  const { buildStatementEmail, loadLiveRate } = await import('./_sendStatement.js')
  const { fetchLedgers } = await import('./_money.js')
  // Pull the live BoE rate into that module before building: its interest
  // figures come from its own module-level rate, which otherwise sits on
  // the hard-coded fallback.
  await loadLiveRate()

  open.sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
  const ledgers = await fetchLedgers(supabase, open.map((i) => i.id))
  const oldestDfd = Math.max(...open.map((i) => daysLate(i.due_date)))

  const email = buildStatementEmail(
    open, profile, ledgers, [], null, ledgers, { chase: true, daysLate: oldestDfd })

  const ccList = []
  for (const inv of open) {
    if (!inv.cc_emails) continue
    inv.cc_emails.split(',').map((e) => e.trim()).filter(Boolean).forEach((e) => {
      if (!ccList.includes(e)) ccList.push(e)
    })
  }

  const payload = {
    from: `${email.fromName} via Hielda <chase@hielda.com>`,
    reply_to: profile.email,
    to: [clientEmail],
    // The freelancer is always BCC'd, never on the visible recipient list.
    bcc: [profile.email],
    subject: email.subject,
    html: email.html,
    headers: { 'List-Unsubscribe': `<mailto:unsubscribe@hielda.com?subject=Unsubscribe>` },
  }
  if (ccList.length) payload.cc = ccList

  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const sendData = await sendRes.json().catch(() => ({}))
  if (!sendRes.ok) {
    console.error('[check-in] group chase send failed:', sendData?.message)
    return html('Send Failed', `
      <div style="font-size:36px;margin-bottom:16px;">&#9888;</div>
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Couldn't send the chase</h2>
      <p style="color:#64748b;margin:0 0 20px;">Nothing was sent and nothing was logged, so you can try again from your dashboard.</p>
      <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
    `, '#9f1239')
  }

  // Log and advance every invoice in the group. resend_id is what the
  // bounce/complaint webhook matches on — without it a hard bounce on the
  // main automated path was invisible.
  await supabase.from('chase_log').insert(
    open.map((i) => ({
      invoice_id: i.id,
      user_id: i.user_id,
      chase_stage: chaseStage,
      email_to: clientEmail,
      status: 'sent',
      resend_id: sendData?.id || null,
      delivery_status: 'pending',
    }))
  )
  await supabase.from('invoices').update({ chase_stage: chaseStage }).in('id', open.map((i) => i.id))

  return html('Chase Sent', `
    <div style="font-size:48px;margin-bottom:16px;color:#16a34a;">&#10004;</div>
    <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">One chase sent, covering ${open.length} invoices</h2>
    <p style="color:#64748b;margin:0 0 4px;">Sent to ${clientName}, itemising each invoice and the combined total.</p>
    <p style="color:#94a3b8;font-size:12px;margin:0 0 20px;">You're BCC'd on it.</p>
    <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
  `, '#16a34a')
}

export default async function handler(req, res) {
  // Accept GET (email links) and POST (confirmation button on chase action)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send('Method not allowed')
  }

  // Load live BoE rate before calculating
  await loadLiveRate()

  try {
    const { action, invoice_id, stage, token, invoice_ids } = req.query

    // Grouped chase: one client, several overdue invoices, one approval,
    // one email. Handled separately because everything below assumes a
    // single invoice.
    if (invoice_ids && action === 'chase') {
      return handleGroupChase(req, res, { invoice_ids, stage, token })
    }

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

      // GET = confirmation page. Mail clients prefetch links: a prefetch of
      // "Yes, they've paid" used to record a payment and mark the invoice
      // paid without anyone clicking. Only POST acts — same as the chase.
      if (req.method !== 'POST') {
        return res.status(200).setHeader('Content-Type', 'text/html').send(
          respondHtml('Confirm Payment', `
            <div style="font-size:48px;margin-bottom:16px;color:#16a34a;">&#10003;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Mark ${esc(invoice.ref)} as paid?</h2>
            <p style="color:#0f172a;margin:0 0 4px;"><strong>${fmt(invoice.amount)}</strong> from ${esc(invoice.client_name)}</p>
            <p style="color:#64748b;margin:0 0 20px;">Hielda will record the payment and stop chasing. If they paid a different amount, record it from the invoice page instead.</p>
            <form method="POST" action="/api/check-in-response?action=paid&invoice_id=${encodeURIComponent(invoice_id)}&token=${encodeURIComponent(token)}">
              <button type="submit" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;">Yes, they've paid in full</button>
            </form>
            <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;">Changed your mind? Just close this tab.</p>
          `, '#16a34a')
        )
      }

      // Mark as paid — and record the money. A bare status flip left the
      // cash out of the ledger, which misreported part-paid invoices as
      // "settled short". The check-in flow can't ask how much arrived, so
      // it assumes paid-in-full: the outstanding balance plus accrued
      // charges, logged as a payment dated today. If the real amount
      // differed, the payment is undoable from the invoice page.
      const today = new Date().toISOString().split('T')[0]
      const face = Number(invoice.amount) || 0
      const alreadyPaid = Number(invoice.amount_paid) || 0
      const outstandingNow = Math.max(0, Math.round((face - alreadyPaid) * 100) / 100)
      const dl = Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 864e5))
      const finesEnabled = !invoice.no_fines && invoice.client_type !== 'consumer'
      const debtAtDue = Math.max(0, face - (Number(invoice.paid_before_due) || 0))
      const pen = dl > 0 && finesEnabled && outstandingNow > 0 && debtAtDue > 0
        ? (debtAtDue < 1000 ? 40 : debtAtDue < 10000 ? 70 : 100) : 0
      // Accrued per balance period off the ledger — this figure becomes a
      // real payment row, so a flat approximation would bake an error into
      // the books.
      const ledger = (await fetchLedgers(supabase, [invoice_id]))[invoice_id] ?? null
      const interest = dl > 0 && finesEnabled
        ? accruedInterest(invoice, ledger, RATE / 365 / 100) : 0
      const owedNow = Math.round((outstandingNow + pen + interest) * 100) / 100

      if (owedNow > 0) {
        await supabase.from('invoice_payments').insert({
          invoice_id,
          user_id: invoice.user_id,
          amount: owedNow,
          paid_on: today,
        })
      }
      await supabase
        .from('invoices')
        .update({
          amount_paid: Math.round((alreadyPaid + owedNow) * 100) / 100,
          status: 'paid',
          paid_date: today,
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
      // GET = confirmation page; a prefetch must not silently switch
      // chasing off. Only POST acts.
      if (req.method !== 'POST') {
        return res.status(200).setHeader('Content-Type', 'text/html').send(
          respondHtml('Confirm', `
            <div style="font-size:48px;margin-bottom:16px;color:#64748b;">&#10074;&#10074;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Stop chasing ${esc(invoice.ref)}?</h2>
            <p style="color:#64748b;margin:0 0 20px;">Automatic chasing will be switched off for this invoice. You can turn it back on from the invoice page.</p>
            <form method="POST" action="/api/check-in-response?action=skip&invoice_id=${encodeURIComponent(invoice_id)}&token=${encodeURIComponent(token)}">
              <button type="submit" style="display:inline-block;padding:14px 32px;background:#64748b;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;">Yes, stop chasing</button>
            </form>
          `, '#64748b')
        )
      }

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
      // Use the stage from the signed token (matches the check-in that was sent).
      // DO NOT use invoice.chase_stage — after the first click advances the stage,
      // subsequent clicks would read the advanced stage, bypass dedup, and send
      // duplicate chase emails for different stages.
      const chaseStage = tokenData.chase_stage || stage || invoice.chase_stage || 'first_chase'

      // Deduplication: check if this chase stage was already sent
      const { data: existingSend } = await supabase
        .from('chase_log')
        .select('id')
        .eq('invoice_id', invoice_id)
        .eq('chase_stage', chaseStage)
        .eq('status', 'sent')
        .limit(1)

      if (existingSend && existingSend.length > 0) {
        return res.status(200).setHeader('Content-Type', 'text/html').send(
          respondHtml('Already Sent', `
            <div style="font-size:48px;margin-bottom:16px;color:#1e5fa0;">&#9993;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Chase Already Sent</h2>
            <p style="color:#64748b;margin:0 0 4px;">The chase email for invoice <strong>${invoice.ref}</strong> has already been sent to <strong>${invoice.client_name}</strong>.</p>
            <p style="color:#94a3b8;font-size:12px;margin:0 0 20px;">No duplicate email was sent.</p>
            <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
          `, '#1e5fa0')
        )
      }

      // GET = show confirmation page (prevents email client link prefetching from
      // silently triggering chase sends). Only POST actually sends the chase.
      if (req.method === 'GET') {
        const stageColor = STAGE_COLORS[chaseStage] || '#1e5fa0'
        return res.status(200).setHeader('Content-Type', 'text/html').send(
          respondHtml('Confirm Chase', `
            <div style="font-size:48px;margin-bottom:16px;color:${stageColor};">&#9993;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Send Chase to ${esc(invoice.client_name)}?</h2>
            <p style="color:#0f172a;margin:0 0 4px;">Invoice <strong>${esc(invoice.ref)}</strong> for <strong>${fmt(invoice.amount)}</strong></p>
            <p style="color:#64748b;margin:0 0 20px;">Click below to send the chase email to your client.</p>
            <form method="POST" action="/api/check-in-response?action=chase&invoice_id=${encodeURIComponent(invoice_id)}&stage=${encodeURIComponent(chaseStage)}&token=${encodeURIComponent(token)}">
              <button type="submit" style="display:inline-block;padding:14px 32px;background:${stageColor};color:#fff;border:none;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;">Yes, send the chase</button>
            </form>
            <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;">Changed your mind? Just close this tab.</p>
          `, stageColor)
        )
      }

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

      // Same gate as every client-facing send. This link was emailed days
      // ago and stays valid for a week; whatever changed since — paid,
      // disputed, parked, auto-chase switched off, a Letter Before Action
      // sent — is checked now, at the moment of sending.
      const block = clientSendBlock(invoice, 'chase')
      if (block) {
        return res.status(200).setHeader('Content-Type', 'text/html').send(
          respondHtml('Nothing Sent', `
            <div style="font-size:48px;margin-bottom:16px;color:#16a34a;">&#10003;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">No chase was sent</h2>
            <p style="color:#64748b;margin:0 0 20px;">${esc(block.message)}</p>
            <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
          `, '#16a34a')
        )
      }

      // Build and send the chase email to the client (respect no_fines flag).
      // This used to charge interest and the fixed fee on the FULL invoice
      // amount regardless of what had already been paid, which over-charged
      // any part-paid client. Same engine as every other surface now.
      const dl = daysLate(invoice.due_date)
      // The 1998 Act is business-to-business only: a consumer is never
      // charged statutory interest or the fixed fee, whatever no_fines says.
      const finesEnabled = !invoice.no_fines && invoice.client_type !== 'consumer'
      const outstandingNow = Math.max(0, Math.round(
        (Number(invoice.amount) - (Number(invoice.amount_paid) || 0)) * 100) / 100)
      const debtAtDue = Math.max(0, Math.round(
        (Number(invoice.amount) - (Number(invoice.paid_before_due) || 0)) * 100) / 100)
      const ledger = (await fetchLedgers(supabase, [invoice.id]))[invoice.id] ?? null
      const interest = finesEnabled ? accruedInterest(invoice, ledger, DAILY_RATE) : 0
      const pen = finesEnabled && outstandingNow > 0 && debtAtDue > 0 ? penalty(debtAtDue) : 0
      const total = Math.round((outstandingNow + interest + pen) * 100) / 100

      const tone = profile.chase_tone || 'firm'
      const email = buildChaseEmailHtml(invoice, profile, chaseStage, dl, interest, pen, total, tone, finesEnabled)

      // Attach the invoice PDF. Best-effort — chase still sends without
      // the attachment if PDF generation fails.
      const pdfAttachment = await getInvoicePdfAttachment(invoice.id, invoice.ref)

      const checkInPayload = {
        from: `${email.fromName} via Hielda <chase@hielda.com>`,
        reply_to: profile.email,
        to: [invoice.client_email],
        subject: email.subject,
        html: email.html,
        headers: { 'List-Unsubscribe': `<mailto:unsubscribe@hielda.com?subject=Unsubscribe%20${invoice.ref}>` },
      }
      if (pdfAttachment) checkInPayload.attachments = [pdfAttachment]

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkInPayload),
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

      // Log the chase send (unique index on (invoice_id, chase_stage) WHERE status='sent'
      // catches race conditions where two requests slip through the app-level dedup)
      // resend_id is what the bounce/complaint webhook matches on. Without
      // it every cron-approved chase — the main automated path — was
      // invisible to delivery tracking.
      const { error: logErr } = await supabase.from('chase_log').insert({
        invoice_id,
        user_id: invoice.user_id,
        chase_stage: chaseStage,
        email_to: invoice.client_email,
        status: 'sent',
        resend_id: resendData?.id || null,
        delivery_status: 'pending',
      })

      if (logErr?.code === '23505') {
        // Unique constraint violation — another request already logged this send
        return res.status(200).setHeader('Content-Type', 'text/html').send(
          respondHtml('Already Sent', `
            <div style="font-size:48px;margin-bottom:16px;color:#1e5fa0;">&#9993;</div>
            <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Chase Already Sent</h2>
            <p style="color:#64748b;margin:0 0 20px;">This chase was already sent. No duplicate was created.</p>
            <a href="https://www.hielda.com" style="display:inline-block;padding:10px 24px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Go to Dashboard</a>
          `, '#1e5fa0')
        )
      }

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
