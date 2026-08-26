// Send a consolidated statement via Resend. One email to one client
// itemising every outstanding invoice — refs, dates, days late, what's
// been paid, late charges, and a single total.
//
// Not a standalone endpoint: the Hobby plan caps deployments at 12
// serverless functions, so this is dispatched from send-chase-email.js
// when the request body carries invoice_ids instead of a chase_stage.

import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function esc(text) {
  if (!text) return ''
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Fallback rate — overridden by live BoE fetch
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

function round2(n) {
  return Math.round(n * 100) / 100
}

// Same maths as send-chase-email.js: interest accrues on the outstanding
// balance, the fixed fee tiers on the debt that went overdue (pre-due
// payments reduce it), and no_fines invoices charge nothing extra.
function invoiceFigures(invoice) {
  const dl = daysLate(invoice.due_date)
  const finesEnabled = !invoice.no_fines && invoice.client_type !== 'consumer'
  const amountPaid = Number(invoice.amount_paid) || 0
  const outstanding = Math.max(0, round2(Number(invoice.amount) - amountPaid))
  const debtAtDue = Math.max(0, round2(Number(invoice.amount) - (Number(invoice.paid_before_due) || 0)))
  const overdue = dl > 0
  const interest = overdue && finesEnabled ? round2(outstanding * DAILY_RATE * dl) : 0
  const pen = overdue && finesEnabled && outstanding > 0 && debtAtDue > 0 ? penalty(debtAtDue) : 0
  const total = round2(outstanding + interest + pen)
  return { dl, amountPaid, outstanding, interest, pen, total }
}

function buildStatementEmail(invoices, profile) {
  const fromName = esc(profile.business_name || profile.full_name || 'Hielda')
  const clientName = esc(invoices[0].client_name || 'there')

  let grandOutstanding = 0
  let grandExtras = 0
  let grandTotal = 0

  const rows = invoices.map((invoice) => {
    const f = invoiceFigures(invoice)
    grandOutstanding = round2(grandOutstanding + f.outstanding)
    grandExtras = round2(grandExtras + f.interest + f.pen)
    grandTotal = round2(grandTotal + f.total)
    const lateNote = f.dl > 0
      ? `<span style="color:#b91c1c;font-weight:600;">${f.dl} day${f.dl === 1 ? '' : 's'} overdue</span>`
      : `<span style="color:#64748b;">due ${formatDate(invoice.due_date)}</span>`
    const paidNote = f.amountPaid > 0
      ? `<div style="font-size:11px;color:#15803d;">−${fmt(f.amountPaid)} received — thank you</div>`
      : ''
    const extrasNote = f.interest + f.pen > 0
      ? `<div style="font-size:11px;color:#a16207;">+${fmt(round2(f.interest + f.pen))} late charges (fixed fee ${fmt(f.pen)} + ${f.dl}d interest at ${RATE}% p.a.)</div>`
      : ''
    return `
      <tr style="border-bottom:1px solid #e8ecf0;">
        <td style="padding:10px 12px 10px 0;vertical-align:top;">
          <div style="font-weight:600;font-size:13px;color:#0f172a;">${esc(invoice.ref)}${invoice.client_ref ? ` <span style="color:#94a3b8;font-weight:400;">(your ref ${esc(invoice.client_ref)})</span>` : ''}</div>
          ${invoice.description ? `<div style="font-size:12px;color:#64748b;">${esc(invoice.description)}</div>` : ''}
          <div style="font-size:11px;color:#94a3b8;">${invoice.issue_date ? `Issued ${formatDate(invoice.issue_date)} · ` : ''}${lateNote}</div>
        </td>
        <td style="padding:10px 0;text-align:right;vertical-align:top;white-space:nowrap;">
          <div style="font-family:monospace;font-size:13px;color:#0f172a;">${fmt(invoice.amount)}</div>
          ${paidNote}
          ${extrasNote}
          <div style="font-family:monospace;font-size:13px;font-weight:700;color:#1e5fa0;margin-top:2px;">${fmt(f.total)}</div>
        </td>
      </tr>`
  }).join('')

  const payBlock = `
    <div style="background:#f1f3f6;padding:14px 18px;border-radius:8px;margin:16px 0;font-size:13px;">
      <div style="font-weight:600;color:#0f172a;margin-bottom:6px;">Payment Details</div>
      <div style="color:#64748b;">
        Account Name: ${esc(profile.account_name) || '—'}<br/>
        Bank: ${esc(profile.bank_name) || '—'}<br/>
        Sort Code: ${esc(profile.sort_code) || '—'}<br/>
        Account: ${esc(profile.account_number) || '—'}<br/>
        Reference: please quote the invoice number(s) you are paying
      </div>
    </div>`

  const anyOverdue = invoices.some((i) => daysLate(i.due_date) > 0)
  const subject = `Statement of account — ${fmt(grandTotal)} outstanding across ${invoices.length} invoice${invoices.length === 1 ? '' : 's'} — ${fromName}`

  const body = `
    <p>Dear ${clientName},</p>
    <p>Please find below a statement of the invoices from ${fromName} that remain outstanding, so everything is in one place.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr>
          <th style="padding:4px 12px 6px 0;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;text-align:left;">Invoice</th>
          <th style="padding:4px 0 6px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Amount due</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="background:#eff6ff;border-left:4px solid #1e5fa0;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
      <div style="font-size:12px;color:#1e5fa0;font-weight:600;margin-bottom:4px;">TOTAL NOW OWED</div>
      <div style="font-size:24px;font-weight:700;color:#1e5fa0;">${fmt(grandTotal)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Outstanding invoices: ${fmt(grandOutstanding)}${grandExtras > 0 ? ` + Late charges: ${fmt(grandExtras)}` : ''}</div>
    </div>
    ${anyOverdue ? `<p style="font-size:12px;color:#64748b;">Late charges are applied under the Late Payment of Commercial Debts (Interest) Act 1998 and continue to accrue daily until payment is received.</p>` : ''}
    ${payBlock}
    <p>A single payment of ${fmt(grandTotal)} settles everything above. If any of these invoices have already been paid, or you'd like to discuss them, just reply to this email.</p>
    <p>Kind regards,<br/>${fromName}</p>`

  const html = `<!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
    <body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
          <div style="background:#1e5fa0;padding:16px 24px;">
            <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
          </div>
          <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
            ${body}
          </div>
        </div>
        <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
          Sent via <a href="https://hielda.com?ref=statement-email" style="color:#1e5fa0;text-decoration:none;font-weight:600;">Hielda</a> — Late payment enforcement for freelancers &amp; SMEs.
        </div>
      </div>
    </body>
    </html>`

  return { subject, html, fromName, grandTotal }
}

export async function sendStatement(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  await loadLiveRate()

  try {
    const { invoice_ids, user_token } = req.body

    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0 || invoice_ids.length > 50) {
      return res.status(400).json({ error: 'invoice_ids (1–50) required' })
    }

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Server not configured — missing API keys' })
    }

    if (!user_token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const supabaseAuth = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${user_token}` } },
    })

    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const [{ data: invoices, error: invErr }, { data: profile, error: profErr }] = await Promise.all([
      supabase.from('invoices').select('*').in('id', invoice_ids),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])

    if (invErr || !invoices || invoices.length === 0) {
      return res.status(404).json({ error: 'Invoices not found' })
    }
    if (profErr || !profile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    // Every invoice must belong to the caller, be unpaid, and share one
    // client email — a statement is one client's account, nothing else.
    if (invoices.some((i) => i.user_id !== user.id)) {
      return res.status(403).json({ error: 'You do not own all of these invoices' })
    }
    const open = invoices.filter((i) => i.status !== 'paid' && i.status !== 'disputed')
    if (open.length === 0) {
      return res.status(400).json({ error: 'No open invoices to include' })
    }
    const clientEmail = open[0].client_email
    if (!clientEmail) {
      return res.status(400).json({ error: 'No client email on these invoices' })
    }
    if (open.some((i) => (i.client_email || '').toLowerCase() !== clientEmail.toLowerCase())) {
      return res.status(400).json({ error: 'All invoices must be for the same client email' })
    }

    // Subscription check — same rule as chase emails
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, trial_end')
      .eq('user_id', user.id)
      .single()

    if (sub) {
      const isActive = sub.status === 'active' ||
        (sub.status === 'trialing' && new Date(sub.trial_end) > new Date())
      if (!isActive) {
        return res.status(403).json({ error: 'Your subscription has expired. Please renew to continue sending emails.' })
      }
    }

    // Rate limiting: max 3 statements per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentStatements } = await supabase
      .from('chase_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'statement_sent')
      .gte('sent_at', oneHourAgo)

    if (recentStatements >= 3) {
      return res.status(429).json({ error: 'Too many statements sent recently. Please wait before sending more.' })
    }

    // Oldest debt first — the natural reading order for a statement
    open.sort((a, b) => (a.due_date < b.due_date ? -1 : 1))

    const email = buildStatementEmail(open, profile)

    const resendPayload = {
      from: `${email.fromName} via Hielda <chase@hielda.com>`,
      reply_to: profile.email,
      to: [clientEmail],
      subject: email.subject,
      html: email.html,
      headers: { 'List-Unsubscribe': `<mailto:unsubscribe@hielda.com?subject=Unsubscribe%20statement>` },
    }
    const bccList = [profile.email].filter(Boolean)
    if (bccList.length > 0) resendPayload.bcc = bccList

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      return res.status(500).json({ error: resendData.message || 'Email send failed' })
    }

    // One log row per included invoice so each invoice's chase log shows
    // the statement went out. status 'statement_sent' keeps these clear of
    // the (invoice_id, chase_stage) unique index on status='sent'.
    await supabase.from('chase_log').insert(open.map((i) => ({
      invoice_id: i.id,
      user_id: user.id,
      chase_stage: 'statement',
      email_to: clientEmail,
      status: 'statement_sent',
      resend_id: resendData.id || null,
      delivery_status: 'pending',
    })))

    return res.status(200).json({
      success: true,
      resend_id: resendData.id,
      email_to: clientEmail,
      invoice_count: open.length,
      total: email.grandTotal,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
