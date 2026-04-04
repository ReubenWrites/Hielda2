// Vercel Serverless Function: Send a chase email via Resend
// Called from the frontend when user clicks "Send Chase Email"

import { createClient } from '@supabase/supabase-js'
import { friendlySubject, friendlyBody, legalSubject, legalBody } from './_toneModifiers.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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

const STAGE_COLORS = {
  reminder_1: '#1e5fa0', reminder_2: '#2d72b8', final_warning: '#b45309',
  first_chase: '#d97706', second_chase: '#c2410c', third_chase: '#b91c1c',
  chase_4: '#9f1239', chase_5: '#9f1239', chase_6: '#9f1239', chase_7: '#9f1239',
  chase_8: '#9f1239', chase_9: '#9f1239', chase_10: '#9f1239', chase_11: '#9f1239',
  escalation_1: '#7f1d1d', escalation_2: '#7f1d1d', escalation_3: '#7f1d1d', escalation_4: '#7f1d1d',
  final_notice: '#7f1d1d',
}

function lineItemsBlock(invoice) {
  if (!invoice.line_items?.length) return ''
  const rows = invoice.line_items.map(li =>
    `<tr style="border-bottom:1px solid #e8ecf0;">
      <td style="padding:7px 16px 7px 0;color:#374151;font-size:13px;">${li.description}</td>
      <td style="padding:7px 0;font-size:13px;text-align:right;font-weight:500;font-family:monospace;">${fmt(li.amount)}</td>
    </tr>`
  ).join('')
  return `
    <table style="width:100%;border-collapse:collapse;margin:14px 0 8px;">
      <thead>
        <tr>
          <th style="padding:4px 16px 6px 0;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;text-align:left;">Description</th>
          <th style="padding:4px 0 6px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="border-top:2px solid #dce1e8;">
          <td style="padding:8px 0 2px;font-weight:700;font-size:13px;">Total</td>
          <td style="padding:8px 0 2px;font-weight:700;font-size:14px;text-align:right;font-family:monospace;color:#1e5fa0;">${fmt(invoice.amount)}</td>
        </tr>
      </tfoot>
    </table>`
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
        Reference: ${invoice.ref}${invoice.client_ref ? `<br/>Your ref: ${invoice.client_ref}` : ''}
      </div>
    </div>
  `
}

function buildEmail(invoice, profile, stage, dl, interest, pen, total, tone = 'firm') {
  const fromName = profile.business_name || profile.full_name || 'Hielda'
  const color = STAGE_COLORS[stage] || '#1e5fa0'
  const payBlock = paymentDetailsBlock(invoice, profile)
  const lineBlock = lineItemsBlock(invoice)
  const poRef = invoice.client_ref ? ` (${invoice.client_ref})` : ''

  const interestTable = `
      ${lineBlock}
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Original invoice</td><td style="padding:6px 0;font-weight:600;">${fmt(invoice.amount)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Fixed penalty</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(pen)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Interest (${dl} days at ${RATE}% p.a.)</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(interest)}</td></tr>
        <tr style="border-top:2px solid #1e5fa0;"><td style="padding:10px 16px 6px 0;font-weight:700;">TOTAL NOW OWED</td><td style="padding:10px 0 6px;font-weight:700;font-size:16px;color:#1e5fa0;">${fmt(total)}</td></tr>
      </table>`

  const totalBlock = `
      ${lineBlock}
      <div style="background:#fef2f2;border-left:4px solid #9f1239;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
        <div style="font-size:12px;color:#9f1239;font-weight:600;margin-bottom:4px;">TOTAL NOW OWED</div>
        <div style="font-size:24px;font-weight:700;color:#9f1239;">${fmt(total)}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">Original: ${fmt(invoice.amount)} + Penalty: ${fmt(pen)} + Interest: ${fmt(interest)}</div>
      </div>`

  const subjects = {
    reminder_1: `Payment reminder: Invoice ${invoice.ref}${poRef} — ${fmt(invoice.amount)}`,
    reminder_2: `Upcoming: Invoice ${invoice.ref}${poRef} due tomorrow — ${fmt(invoice.amount)}`,
    final_warning: `URGENT: Invoice ${invoice.ref}${poRef} — last chance to settle at ${fmt(invoice.amount)}`,
    first_chase: `OVERDUE: Invoice ${invoice.ref}${poRef} — ${fmt(total)} now owed`,
    second_chase: `OVERDUE: Invoice ${invoice.ref}${poRef} — ${dl} days late, ${fmt(total)} owed`,
    third_chase: `OVERDUE: Invoice ${invoice.ref}${poRef} — ${fmt(total)} outstanding`,
    chase_4: `URGENT: Invoice ${invoice.ref}${poRef} — ${fmt(total)} overdue`,
    chase_5: `URGENT: Invoice ${invoice.ref}${poRef} — immediate payment required`,
    chase_6: `OVERDUE: Invoice ${invoice.ref}${poRef} — ${fmt(total)} still outstanding`,
    chase_7: `URGENT: Invoice ${invoice.ref}${poRef} — ${fmt(total)} overdue`,
    chase_8: `OVERDUE: Invoice ${invoice.ref}${poRef} — ${dl} days, ${fmt(total)} owed`,
    chase_9: `OVERDUE: Invoice ${invoice.ref}${poRef} — payment demand`,
    chase_10: `URGENT: Invoice ${invoice.ref}${poRef} — ${fmt(total)} outstanding`,
    chase_11: `OVERDUE: Invoice ${invoice.ref}${poRef} — final chase before escalation`,
    escalation_1: `WARNING: Invoice ${invoice.ref}${poRef} — escalation in 4 days`,
    escalation_2: `WARNING: Invoice ${invoice.ref}${poRef} — escalation in 3 days`,
    escalation_3: `WARNING: Invoice ${invoice.ref}${poRef} — escalation in 2 days`,
    escalation_4: `WARNING: Invoice ${invoice.ref}${poRef} — escalation tomorrow`,
    final_notice: `FINAL NOTICE: Invoice ${invoice.ref}${poRef} — ${fmt(total)} overdue. Legal action pending.`,
  }

  const bodies = {
    reminder_1: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is a friendly reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due by <strong>${formatDate(invoice.due_date)}</strong>.</p>
      <div style="background:#f0f7ff;border-left:3px solid #1e5fa0;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:13px;color:#1e3a5f;">
        <strong>${formatDate(invoice.due_date)}</strong> is the final date this invoice can be settled at the original amount of <strong>${fmt(invoice.amount)}</strong>. After this date, statutory fines and interest will apply. Early payment is always appreciated.
      </div>
      ${lineBlock}
      ${payBlock}
      <p>If you've already made payment, please disregard this message.</p>
      <p>Kind regards,<br/>${fromName}</p>
    `,
    reminder_2: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is a reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due <strong>tomorrow</strong> (${formatDate(invoice.due_date)}).</p>
      <div style="background:#f0f7ff;border-left:3px solid #1e5fa0;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:13px;color:#1e3a5f;">
        <strong>${formatDate(invoice.due_date)}</strong> is the final date this invoice can be settled at the original amount of <strong>${fmt(invoice.amount)}</strong>. After this date, statutory fines and interest will apply. Early payment is always appreciated.
      </div>
      ${lineBlock}
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    final_warning: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due <strong>today</strong> (${formatDate(invoice.due_date)}).</p>
      <p><strong>This is your last opportunity to settle this invoice at the original amount of ${fmt(invoice.amount)}.</strong></p>
      <p>If payment is not received by end of business today, we will be entitled to add statutory interest and a fixed penalty under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>. This means the amount owed will increase from tomorrow.</p>
      <p>Please arrange payment immediately to avoid additional charges.</p>
      ${lineBlock}
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    first_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> was due by <strong>${formatDate(invoice.due_date)}</strong> and remains unpaid.</p>
      <p>As notified, under the Late Payment of Commercial Debts (Interest) Act 1998, the following statutory charges have now been applied:</p>
      ${interestTable}
      <p>Please arrange payment of <strong>${fmt(total)}</strong> immediately. Interest continues to accrue daily.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    second_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong>. Despite previous correspondence, payment has not been received.</p>
      <p>The amount owed continues to increase under the Late Payment of Commercial Debts (Interest) Act 1998:</p>
      ${interestTable}
      <p>Please settle this amount immediately to prevent further charges.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    third_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is our third notice regarding invoice <strong>${invoice.ref}</strong>, which is now <strong>${dl} days overdue</strong>.</p>
      <p>The current amount owed is <strong>${fmt(total)}</strong> and continues to grow daily under the Late Payment of Commercial Debts (Interest) Act 1998.</p>
      ${interestTable}
      <p>We strongly urge you to settle this debt without further delay.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    chase_4: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> remains unpaid after <strong>${dl} days</strong>. Multiple reminders have been sent.</p>
      ${totalBlock}
      <p>Please arrange payment today. Continued non-payment may result in further action.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    chase_5: `
      <p>Dear ${invoice.client_name},</p>
      <p>We are writing again regarding invoice <strong>${invoice.ref}</strong>, now <strong>${dl} days overdue</strong>.</p>
      ${totalBlock}
      <p>Immediate payment is required. We reserve the right to pursue this debt through formal channels if it remains unsettled.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    chase_6: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> has been outstanding for <strong>${dl} days</strong>. This matter is becoming urgent.</p>
      ${totalBlock}
      <p>Please settle the amount of <strong>${fmt(total)}</strong> without further delay to avoid escalation.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    chase_7: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong> and remains unpaid despite repeated communications.</p>
      ${totalBlock}
      <p>If payment of <strong>${fmt(total)}</strong> is not received promptly, we will proceed to the next stage of recovery.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    chase_8: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> has been outstanding for <strong>${dl} days</strong>. The amount owed continues to increase daily.</p>
      ${totalBlock}
      <p>Please settle this debt immediately.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    chase_9: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is a further demand for payment of invoice <strong>${invoice.ref}</strong>, now <strong>${dl} days overdue</strong>.</p>
      ${totalBlock}
      <p>We have made numerous attempts to resolve this. Immediate payment is required.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    chase_10: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> remains unpaid after <strong>${dl} days</strong>. Interest continues to accrue daily under the Late Payment of Commercial Debts (Interest) Act 1998.</p>
      ${totalBlock}
      <p>Please arrange payment without further delay.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    chase_11: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>This is our final chase before we begin the escalation process.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong>.</p>
      ${totalBlock}
      <p>If payment is not received within the next 5 days, we will begin formal escalation proceedings. You will receive daily notices until the deadline.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    escalation_1: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>ESCALATION NOTICE — 4 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. You have <strong>4 days</strong> to settle this debt before we pursue formal recovery.</p>
      ${totalBlock}
      <p>Formal recovery may include referral to a debt recovery agency or County Court proceedings, which could adversely affect your credit rating.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    escalation_2: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>ESCALATION NOTICE — 3 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. You have <strong>3 days</strong> to settle before formal recovery begins.</p>
      ${totalBlock}
      <p>This is your opportunity to resolve this matter without court involvement.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    escalation_3: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>ESCALATION NOTICE — 2 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. You have <strong>2 days</strong> to pay before we escalate.</p>
      ${totalBlock}
      <p>We strongly advise you to settle this debt immediately to avoid formal proceedings.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    escalation_4: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>ESCALATION NOTICE — this is your final day to pay.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. If payment of <strong>${fmt(total)}</strong> is not received by end of business <strong>tomorrow</strong>, we will commence formal recovery proceedings.</p>
      ${totalBlock}
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    final_notice: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FINAL NOTICE — This is our last communication before we pursue formal recovery.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong>. Despite numerous attempts to resolve this, payment has not been received.</p>
      ${totalBlock}
      <p>If payment is not received within <strong>7 days</strong>, the creditor may have no choice but to pursue this debt through formal channels, which may include referral to a debt recovery agency or County Court proceedings.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
  }

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
          Sent via <a href="https://hielda.com?ref=chase-email" style="color:#1e5fa0;text-decoration:none;font-weight:600;">Hielda</a> — Late payment enforcement for freelancers &amp; SMEs.
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

  // Load live BoE rate before calculating
  await loadLiveRate()

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

    // Fetch invoice and profile in parallel
    const [{ data: invoice, error: invErr }, { data: profile, error: profErr }] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', invoice_id).single(),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])

    if (invErr || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    // ── Authorization: check invoice ownership ──
    if (invoice.user_id !== user.id) {
      return res.status(403).json({ error: 'You do not own this invoice' })
    }

    if (profErr || !profile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    // ── Subscription check: ensure user has active subscription ──
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, trial_end')
      .eq('user_id', user.id)
      .single()

    if (sub) {
      const isActive = sub.status === 'active' ||
        (sub.status === 'trialing' && new Date(sub.trial_end) > new Date())
      if (!isActive) {
        return res.status(403).json({ error: 'Your subscription has expired. Please renew to continue sending chase emails.' })
      }
    }

    if (!invoice.client_email) {
      return res.status(400).json({ error: 'No client email on this invoice' })
    }

    // Idempotency: check if this stage was already sent
    const { data: existingSend } = await supabase
      .from('chase_log')
      .select('id')
      .eq('invoice_id', invoice_id)
      .eq('chase_stage', chase_stage)
      .eq('status', 'sent')
      .limit(1)

    if (existingSend && existingSend.length > 0) {
      return res.status(409).json({ error: 'This chase stage has already been sent for this invoice' })
    }

    // Calculate amounts (respect no_fines flag), rounded to avoid floating-point display issues
    const dl = daysLate(invoice.due_date)
    const finesEnabled = !invoice.no_fines
    const interest = finesEnabled ? Math.round(Number(invoice.amount) * DAILY_RATE * dl * 100) / 100 : 0
    const pen = finesEnabled ? penalty(Number(invoice.amount)) : 0
    const total = Math.round((Number(invoice.amount) + interest + pen) * 100) / 100

    // Build email (use profile's chase_tone, default to 'firm')
    const tone = profile.chase_tone || 'firm'
    const email = buildEmail(invoice, profile, chase_stage, dl, interest, pen, total, tone)

    // Build CC list: always include the freelancer, plus any custom CC on the invoice
    const ccList = [profile.email].filter(Boolean)
    if (invoice.cc_emails) {
      invoice.cc_emails.split(',').map(e => e.trim()).filter(Boolean).forEach(e => ccList.push(e))
    }

    // Build BCC list from invoice
    const bccList = invoice.bcc_emails
      ? invoice.bcc_emails.split(',').map(e => e.trim()).filter(Boolean)
      : []

    // Send via Resend
    const resendPayload = {
      from: `${email.fromName} via Hielda <chase@hielda.com>`,
      reply_to: profile.email,
      to: [invoice.client_email],
      subject: email.subject,
      html: email.html,
      headers: { 'List-Unsubscribe': `<mailto:unsubscribe@hielda.com?subject=Unsubscribe%20${invoice.ref}>` },
    }
    if (ccList.length > 0) resendPayload.cc = ccList
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

    // Log the send
    await supabase.from('chase_log').insert({
      invoice_id,
      user_id: invoice.user_id,
      chase_stage,
      email_to: invoice.client_email,
      status: 'sent',
      resend_id: resendData.id || null,
      delivery_status: 'pending',
    })

    // Advance invoice to next chase stage
    const STAGE_ORDER = [
      "reminder_1", "reminder_2", "final_warning", "first_chase", "second_chase", "third_chase",
      "chase_4", "chase_5", "chase_6", "chase_7", "chase_8", "chase_9", "chase_10", "chase_11",
      "escalation_1", "escalation_2", "escalation_3", "escalation_4", "final_notice",
    ]
    const currentIdx = STAGE_ORDER.indexOf(chase_stage)
    const nextStage = currentIdx >= 0 && currentIdx < STAGE_ORDER.length - 1
      ? STAGE_ORDER[currentIdx + 1]
      : chase_stage
    await supabase
      .from('invoices')
      .update({ chase_stage: nextStage })
      .eq('id', invoice_id)

    return res.status(200).json({ success: true, resend_id: resendData.id, email_to: invoice.client_email })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
