// Vercel Serverless Function: Send a chase email via Resend
// Called from the frontend when user clicks "Send Chase Email"

import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const RATE = 11.75
const DAILY_RATE = RATE / 365 / 100

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

const STAGE_COLORS = {
  reminder_1: '#1e5fa0', reminder_2: '#2d72b8', first_chase: '#d97706',
  second_chase: '#c2410c', final_notice: '#9f1239',
}

function paymentDetailsBlock(invoice, profile) {
  return `
    <div style="background:#f1f3f6;padding:14px 18px;border-radius:8px;margin:16px 0;font-size:13px;">
      <div style="font-weight:600;color:#0f172a;margin-bottom:6px;">Payment Details</div>
      <div style="color:#64748b;">
        Account Name: ${profile.account_name || '—'}<br/>
        Bank: ${profile.bank_name || '—'}<br/>
        Sort Code: ${profile.sort_code || '—'}<br/>
        Account: ${profile.account_number || '—'}<br/>
        Reference: ${invoice.ref}
      </div>
    </div>
  `
}

function buildEmail(invoice, profile, stage, dl, interest, pen, total) {
  const fromName = profile.business_name || profile.full_name || 'Hielda'
  const color = STAGE_COLORS[stage] || '#1e5fa0'
  const payBlock = paymentDetailsBlock(invoice, profile)

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
      <p>This is a friendly reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due on <strong>${formatDate(invoice.due_date)}</strong>.</p>
      <p>Please ensure payment is made by the due date to avoid any late payment charges.</p>
      ${payBlock}
      <p>If you've already made payment, please disregard this message.</p>
      <p>Kind regards,<br/>${fromName}</p>
    `,
    reminder_2: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is a reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due <strong>tomorrow</strong> (${formatDate(invoice.due_date)}).</p>
      <p>Under the Late Payment of Commercial Debts (Interest) Act 1998, interest and penalties will be applied if payment is not received by the due date.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    first_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> was due on <strong>${formatDate(invoice.due_date)}</strong> and remains unpaid.</p>
      <p>Under the Late Payment of Commercial Debts (Interest) Act 1998, we are entitled to charge interest at <strong>${RATE}% per annum</strong> and a fixed penalty. Interest is now accruing on this debt.</p>
      <p>Please arrange payment immediately.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
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
      <p>Regards,<br/>${fromName}</p>
    `,
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
      <p>Regards,<br/>${fromName}</p>
    `,
  }

  const subject = subjects[stage] || subjects.first_chase
  const body = bodies[stage] || bodies.first_chase

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { invoice_id, chase_stage, user_token } = req.body

    if (!invoice_id || !chase_stage) {
      return res.status(400).json({ error: 'invoice_id and chase_stage required' })
    }

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Server not configured — missing API keys' })
    }

    // ── Authentication: verify user token ──
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

    // Service role client for DB operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single()

    if (invErr || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    // ── Authorization: check invoice ownership ──
    if (invoice.user_id !== user.id) {
      return res.status(403).json({ error: 'You do not own this invoice' })
    }

    // Fetch profile
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', invoice.user_id)
      .single()

    if (profErr || !profile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    if (!invoice.client_email) {
      return res.status(400).json({ error: 'No client email on this invoice' })
    }

    // Calculate amounts
    const dl = daysLate(invoice.due_date)
    const interest = Number(invoice.amount) * DAILY_RATE * dl
    const pen = penalty(Number(invoice.amount))
    const total = Number(invoice.amount) + interest + pen

    // Build email
    const email = buildEmail(invoice, profile, chase_stage, dl, interest, pen, total)

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${email.fromName} via Hielda <chase@hielda.com>`,
        to: [invoice.client_email],
        subject: email.subject,
        html: email.html,
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      return res.status(500).json({ error: resendData.message || 'Email send failed' })
    }

    // Log the send
    await supabase.from('chase_log').insert({
      invoice_id,
      user_id: invoice.user_id,
      chase_stage,
      email_to: invoice.client_email,
      status: 'sent',
    })

    // Update invoice chase stage
    await supabase
      .from('invoices')
      .update({ chase_stage })
      .eq('id', invoice_id)

    return res.status(200).json({ success: true, resend_id: resendData.id, email_to: invoice.client_email })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
