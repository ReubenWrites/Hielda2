// Vercel Cron: Daily automated chase runner
// Runs at 08:00 UTC every day
//
// For each eligible invoice (auto_chase=true, active subscription, has client email):
//   1. Determine which chase stage is due today
//   2. If no check-in sent yet → email the freelancer: "Has your client paid?"
//      - Freelancer clicks "No, send the chase" → chase goes to client (handled by check-in-response.js)
//      - Freelancer clicks "Yes, they've paid" → invoice marked paid
//      - Freelancer doesn't respond → nothing happens; cron checks again tomorrow
//
// Chases are NEVER sent automatically without explicit freelancer approval.
// Also bulk-updates pending→overdue for any past-due invoices.

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = process.env.CRON_SECRET

// Chase stage timing — days from due date (negative = before due)
const CHASE_STAGES = [
  { id: 'reminder_1',   dfd: -5 },
  { id: 'reminder_2',   dfd: -1 },
  { id: 'final_warning',dfd:  0 },
  { id: 'first_chase',  dfd:  1 },
  { id: 'second_chase', dfd:  6 },
  { id: 'third_chase',  dfd:  9 },
  { id: 'chase_4',      dfd: 11 },
  { id: 'chase_5',      dfd: 13 },
  { id: 'chase_6',      dfd: 15 },
  { id: 'chase_7',      dfd: 17 },
  { id: 'chase_8',      dfd: 19 },
  { id: 'chase_9',      dfd: 21 },
  { id: 'chase_10',     dfd: 23 },
  { id: 'chase_11',     dfd: 25 },
  { id: 'escalation_1', dfd: 26 },
  { id: 'escalation_2', dfd: 27 },
  { id: 'escalation_3', dfd: 28 },
  { id: 'escalation_4', dfd: 29 },
  { id: 'final_notice', dfd: 30 },
]

const STAGE_ORDER = CHASE_STAGES.map(s => s.id)

const STAGE_LABELS = {
  reminder_1: 'Friendly Reminder', reminder_2: 'Second Reminder',
  final_warning: 'Final Warning', first_chase: 'First Chase',
  second_chase: 'Second Chase', third_chase: 'Third Chase',
  chase_4: 'Chase 4', chase_5: 'Chase 5', chase_6: 'Chase 6',
  chase_7: 'Chase 7', chase_8: 'Chase 8', chase_9: 'Chase 9',
  chase_10: 'Chase 10', chase_11: 'Chase 11',
  escalation_1: 'Escalation Notice 1', escalation_2: 'Escalation Notice 2',
  escalation_3: 'Escalation Notice 3', escalation_4: 'Escalation Notice 4',
  final_notice: 'Final Notice',
}

const STAGE_COLORS = {
  reminder_1: '#1e5fa0', reminder_2: '#2d72b8', final_warning: '#b45309',
  first_chase: '#d97706', second_chase: '#c2410c', third_chase: '#b91c1c',
  chase_4: '#9f1239', chase_5: '#9f1239', chase_6: '#9f1239', chase_7: '#9f1239',
  chase_8: '#9f1239', chase_9: '#9f1239', chase_10: '#9f1239', chase_11: '#9f1239',
  escalation_1: '#7f1d1d', escalation_2: '#7f1d1d', escalation_3: '#7f1d1d',
  escalation_4: '#7f1d1d', final_notice: '#7f1d1d',
}

// ── Utilities ────────────────────────────────────────────────────────────────

let RATE = 11.75
let DAILY_RATE = RATE / 365 / 100

async function loadLiveRate() {
  try {
    const { fetchBoeRate } = await import('./boe-rate.js')
    const { rate } = await fetchBoeRate()
    RATE = 8 + rate
    DAILY_RATE = RATE / 365 / 100
  } catch { /* keep fallback */ }
}

function daysSinceDue(dueDate) {
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / 864e5)
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

function getNextStageId(stageId) {
  const idx = STAGE_ORDER.indexOf(stageId)
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

function signToken(data) {
  const payload = JSON.stringify({ ...data, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  const sig = crypto.createHmac('sha256', SUPABASE_SERVICE_KEY).update(payload).digest('hex')
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

async function sendViaResend({ from, to, cc, bcc, subject, html }) {
  const payload = { from, to, subject, html }
  if (cc?.length) payload.cc = cc
  if (bcc?.length) payload.bcc = bcc
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Resend error')
  return data
}

// ── Check-in email (to the freelancer) ───────────────────────────────────────

function buildCheckInEmail(invoice, profile, stage) {
  const color = STAGE_COLORS[stage] || '#1e5fa0'
  const stageLabel = STAGE_LABELS[stage] || stage
  const fromName = profile.business_name || profile.full_name || 'Hielda User'
  const token = signToken({ invoice_id: invoice.id, chase_stage: stage, user_id: invoice.user_id })
  const base = 'https://www.hielda.com/api/check-in-response'
  const paidUrl = `${base}?action=paid&invoice_id=${invoice.id}&token=${encodeURIComponent(token)}`
  const chaseUrl = `${base}?action=chase&invoice_id=${invoice.id}&stage=${stage}&token=${encodeURIComponent(token)}`
  const subject = `Check-in: Has ${invoice.client_name} paid invoice ${invoice.ref}?`
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
        <p>Hi ${fromName},</p>
        <p>Before we send a <strong>${stageLabel}</strong> to <strong>${invoice.client_name}</strong>, we wanted to check in with you first.</p>
        <div style="background:#f1f3f6;padding:16px 18px;border-radius:8px;margin:20px 0;font-size:13px;">
          <div style="font-weight:600;color:#0f172a;margin-bottom:8px;">Invoice Details</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:3px 0;color:#64748b;">Reference</td><td style="padding:3px 0;font-weight:500;text-align:right;">${invoice.ref}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Client</td><td style="padding:3px 0;font-weight:500;text-align:right;">${invoice.client_name}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Amount</td><td style="padding:3px 0;font-weight:500;text-align:right;">${fmt(invoice.amount)}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Due Date</td><td style="padding:3px 0;font-weight:500;text-align:right;">${formatDate(invoice.due_date)}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Pending Stage</td><td style="padding:3px 0;font-weight:600;color:${color};text-align:right;">${stageLabel}</td></tr>
          </table>
        </div>
        <p style="font-weight:600;margin-bottom:20px;">Has ${invoice.client_name} paid this invoice?</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${paidUrl}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:0 8px 12px;">Yes, they've paid</a>
          <a href="${chaseUrl}" style="display:inline-block;padding:14px 32px;background:${color};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:0 8px 12px;">No, send the chase</a>
        </div>
        <p style="font-size:12px;color:#94a3b8;text-align:center;">We won't send anything to your client until you give the go-ahead.</p>
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">Sent via Hielda — Protecting your pay.</div>
  </div>
</body>
</html>`
  return { subject, html }
}

// ── Chase email (to the client — 48h auto-fire) ───────────────────────────────

function buildChaseEmail(invoice, profile, stage, dl, interest, pen, total) {
  const color = STAGE_COLORS[stage] || '#1e5fa0'
  const fromName = profile.business_name || profile.full_name || 'Hielda'
  const poRef = invoice.client_ref ? ` (${invoice.client_ref})` : ''

  const payBlock = `
    <div style="background:#f1f3f6;padding:14px 18px;border-radius:8px;margin:16px 0;font-size:13px;">
      <div style="font-weight:600;color:#0f172a;margin-bottom:6px;">Payment Details</div>
      <div style="color:#64748b;">
        Account Name: ${profile.account_name || '—'}<br/>
        Bank: ${profile.bank_name || '—'}<br/>
        Sort Code: ${profile.sort_code || '—'}<br/>
        Account: ${profile.account_number || '—'}<br/>
        Reference: ${invoice.ref}${invoice.client_ref ? `<br/>Your ref: ${invoice.client_ref}` : ''}
      </div>
    </div>`

  const lineBlock = (() => {
    if (!invoice.line_items?.length) return ''
    const rows = invoice.line_items.map(li =>
      `<tr style="border-bottom:1px solid #e8ecf0;">
        <td style="padding:7px 16px 7px 0;color:#374151;font-size:13px;">${li.description}</td>
        <td style="padding:7px 0;font-size:13px;text-align:right;font-weight:500;font-family:monospace;">${fmt(li.amount)}</td>
      </tr>`
    ).join('')
    return `<table style="width:100%;border-collapse:collapse;margin:14px 0 8px;">
      <thead><tr>
        <th style="padding:4px 16px 6px 0;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;text-align:left;">Description</th>
        <th style="padding:4px 0 6px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="border-top:2px solid #dce1e8;">
        <td style="padding:8px 0 2px;font-weight:700;font-size:13px;">Total</td>
        <td style="padding:8px 0 2px;font-weight:700;font-size:14px;text-align:right;font-family:monospace;color:#1e5fa0;">${fmt(invoice.amount)}</td>
      </tr></tfoot>
    </table>`
  })()

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
    reminder_1:   `Payment reminder: Invoice ${invoice.ref}${poRef} — ${fmt(invoice.amount)}`,
    reminder_2:   `Upcoming: Invoice ${invoice.ref}${poRef} due tomorrow — ${fmt(invoice.amount)}`,
    final_warning:`URGENT: Invoice ${invoice.ref}${poRef} — last chance to settle at ${fmt(invoice.amount)}`,
    first_chase:  `OVERDUE: Invoice ${invoice.ref}${poRef} — ${fmt(total)} now owed`,
    second_chase: `OVERDUE: Invoice ${invoice.ref}${poRef} — ${dl} days late, ${fmt(total)} owed`,
    third_chase:  `OVERDUE: Invoice ${invoice.ref}${poRef} — ${fmt(total)} outstanding`,
    chase_4:      `URGENT: Invoice ${invoice.ref}${poRef} — ${fmt(total)} overdue`,
    chase_5:      `URGENT: Invoice ${invoice.ref}${poRef} — immediate payment required`,
    chase_6:      `OVERDUE: Invoice ${invoice.ref}${poRef} — ${fmt(total)} still outstanding`,
    chase_7:      `URGENT: Invoice ${invoice.ref}${poRef} — ${fmt(total)} overdue`,
    chase_8:      `OVERDUE: Invoice ${invoice.ref}${poRef} — ${dl} days, ${fmt(total)} owed`,
    chase_9:      `OVERDUE: Invoice ${invoice.ref}${poRef} — payment demand`,
    chase_10:     `URGENT: Invoice ${invoice.ref}${poRef} — ${fmt(total)} outstanding`,
    chase_11:     `OVERDUE: Invoice ${invoice.ref}${poRef} — final chase before escalation`,
    escalation_1: `WARNING: Invoice ${invoice.ref}${poRef} — escalation in 4 days`,
    escalation_2: `WARNING: Invoice ${invoice.ref}${poRef} — escalation in 3 days`,
    escalation_3: `WARNING: Invoice ${invoice.ref}${poRef} — escalation in 2 days`,
    escalation_4: `WARNING: Invoice ${invoice.ref}${poRef} — escalation tomorrow`,
    final_notice: `FINAL NOTICE: Invoice ${invoice.ref}${poRef} — ${fmt(total)} overdue. Legal action pending.`,
  }

  const bodies = {
    reminder_1: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is a friendly reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due on <strong>${formatDate(invoice.due_date)}</strong>.</p>
      <div style="background:#f0f7ff;border-left:3px solid #1e5fa0;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:13px;color:#1e3a5f;">
        <strong>${formatDate(invoice.due_date)}</strong> is the final date this invoice can be settled at the original amount of <strong>${fmt(invoice.amount)}</strong>. After this date, statutory fines and interest will apply.
      </div>
      ${lineBlock}
      ${payBlock}
      <p>If you've already made payment, please disregard this message.</p>
      <p>Kind regards,<br/>${fromName}</p>`,
    reminder_2: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is a reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due <strong>tomorrow</strong> (${formatDate(invoice.due_date)}).</p>
      <div style="background:#f0f7ff;border-left:3px solid #1e5fa0;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:13px;color:#1e3a5f;">
        <strong>${formatDate(invoice.due_date)}</strong> is the final date this invoice can be settled at the original amount of <strong>${fmt(invoice.amount)}</strong>. After this date, statutory fines and interest will apply.
      </div>
      ${lineBlock}
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>`,
    final_warning: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due <strong>today</strong> (${formatDate(invoice.due_date)}).</p>
      <p><strong>This is your last opportunity to settle this invoice at the original amount of ${fmt(invoice.amount)}.</strong></p>
      <p>If payment is not received by end of business today, we will be entitled to add statutory interest and a fixed penalty under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>.</p>
      ${lineBlock}
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    first_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> was due on <strong>${formatDate(invoice.due_date)}</strong> and remains unpaid.</p>
      <p>Under the Late Payment of Commercial Debts (Interest) Act 1998, the following statutory charges have now been applied:</p>
      ${interestTable}
      <p>Please arrange payment of <strong>${fmt(total)}</strong> immediately.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    second_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong>. Despite previous correspondence, payment has not been received.</p>
      ${interestTable}
      <p>Please settle this amount immediately to prevent further charges.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    third_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is our third notice regarding invoice <strong>${invoice.ref}</strong>, now <strong>${dl} days overdue</strong>. The current amount owed is <strong>${fmt(total)}</strong> and continues to grow daily.</p>
      ${interestTable}
      <p>We strongly urge you to settle this debt without further delay.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    chase_4: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> remains unpaid after <strong>${dl} days</strong>. Multiple reminders have been sent.</p>
      ${totalBlock}
      <p>Please arrange payment today.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    chase_5: `
      <p>Dear ${invoice.client_name},</p>
      <p>We are writing again regarding invoice <strong>${invoice.ref}</strong>, now <strong>${dl} days overdue</strong>.</p>
      ${totalBlock}
      <p>Immediate payment is required. We reserve the right to pursue this debt through formal channels if it remains unsettled.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    chase_6: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> has been outstanding for <strong>${dl} days</strong>. This matter is becoming urgent.</p>
      ${totalBlock}
      <p>Please settle the amount of <strong>${fmt(total)}</strong> without further delay to avoid escalation.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    chase_7: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong> and remains unpaid despite repeated communications.</p>
      ${totalBlock}
      <p>If payment is not received promptly, we will proceed to the next stage of recovery.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    chase_8: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> has been outstanding for <strong>${dl} days</strong>. The amount owed continues to increase daily.</p>
      ${totalBlock}
      <p>Please settle this debt immediately.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    chase_9: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is a further demand for payment of invoice <strong>${invoice.ref}</strong>, now <strong>${dl} days overdue</strong>.</p>
      ${totalBlock}
      <p>We have made numerous attempts to resolve this. Immediate payment is required.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    chase_10: `
      <p>Dear ${invoice.client_name},</p>
      <p>Invoice <strong>${invoice.ref}</strong> remains unpaid after <strong>${dl} days</strong>. Interest continues to accrue daily.</p>
      ${totalBlock}
      <p>Please arrange payment without further delay.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    chase_11: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>This is our final chase before we begin the escalation process.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong>.</p>
      ${totalBlock}
      <p>If payment is not received within the next 5 days, we will begin formal escalation proceedings. You will receive daily notices until the deadline.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    escalation_1: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>ESCALATION NOTICE — 4 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. You have <strong>4 days</strong> to settle this debt before we pursue formal recovery.</p>
      ${totalBlock}
      <p>Formal recovery may include referral to a debt recovery agency or County Court proceedings, which could adversely affect your credit rating.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    escalation_2: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>ESCALATION NOTICE — 3 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. You have <strong>3 days</strong> to settle before formal recovery begins.</p>
      ${totalBlock}
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    escalation_3: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>ESCALATION NOTICE — 2 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. You have <strong>2 days</strong> to pay before we escalate.</p>
      ${totalBlock}
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    escalation_4: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>ESCALATION NOTICE — this is your final day to pay.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. If payment of <strong>${fmt(total)}</strong> is not received by end of business tomorrow, we will commence formal recovery proceedings.</p>
      ${totalBlock}
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
    final_notice: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FINAL NOTICE — This is our last communication before we pursue formal recovery.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong>. Despite numerous attempts, payment has not been received.</p>
      ${totalBlock}
      <p>If payment is not received within <strong>7 days</strong>, the creditor may pursue this debt through formal channels, which may include referral to a debt recovery agency or County Court proceedings.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>`,
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
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">${body}</div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
      Sent via <a href="https://hielda.com?ref=chase-email" style="color:#1e5fa0;text-decoration:none;font-weight:600;">Hielda</a> — Late payment enforcement for freelancers &amp; SMEs.
    </div>
  </div>
</body>
</html>`

  return { subject, html, fromName }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Verify the request is from Vercel Cron (or a manual test with the secret)
  const authHeader = req.headers.authorization
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured — missing env vars' })
  }

  await loadLiveRate()

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const results = { status_updates: 0, check_ins_sent: 0, skipped: 0, errors: 0 }
  const errors = []

  // ── Step 1: Bulk update pending → overdue for all past-due invoices ──────────
  const today = new Date().toISOString().split('T')[0]
  const { count: updated } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('status', 'pending')
    .lt('due_date', today)

  results.status_updates = updated || 0

  // ── Step 2: Find users with active subscriptions ──────────────────────────
  const { data: activeSubs } = await supabase
    .from('subscriptions')
    .select('user_id')
    .in('status', ['active', 'trialing'])

  const activeUserIds = [...new Set((activeSubs || []).map(s => s.user_id))]

  if (activeUserIds.length === 0) {
    return res.status(200).json({ ...results, message: 'No active subscribers — nothing to chase' })
  }

  // ── Step 3: Fetch eligible invoices with profiles ─────────────────────────
  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .in('status', ['pending', 'overdue'])
    .eq('auto_chase', true)
    .not('client_email', 'is', null)
    .in('user_id', activeUserIds)

  if (invErr) {
    return res.status(500).json({ error: invErr.message })
  }

  if (!invoices || invoices.length === 0) {
    return res.status(200).json({ ...results, message: 'No eligible invoices to chase' })
  }

  // ── Step 4: Fetch profiles for these users ───────────────────────────────
  const userIds = [...new Set(invoices.map(i => i.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  // ── Step 5: Fetch recent chase logs for all these invoices ───────────────
  const invoiceIds = invoices.map(i => i.id)
  const { data: logs } = await supabase
    .from('chase_log')
    .select('*')
    .in('invoice_id', invoiceIds)
    .order('created_at', { ascending: false })

  // Index logs by invoice_id → array of log entries
  const logsByInvoice = {}
  for (const log of (logs || [])) {
    if (!logsByInvoice[log.invoice_id]) logsByInvoice[log.invoice_id] = []
    logsByInvoice[log.invoice_id].push(log)
  }

  // ── Step 6: Process each invoice ─────────────────────────────────────────
  for (const invoice of invoices) {
    try {
      const profile = profileMap[invoice.user_id]
      if (!profile?.email) { results.skipped++; continue }

      // Determine the next stage to send
      const nextStageId = invoice.chase_stage || 'reminder_1'
      const nextStage = CHASE_STAGES.find(s => s.id === nextStageId)
      if (!nextStage) { results.skipped++; continue }

      // Is this stage due to fire today?
      const dfd = daysSinceDue(invoice.due_date)
      if (nextStage.dfd > dfd) { results.skipped++; continue }

      // Check the log for this stage on this invoice
      const invoiceLogs = logsByInvoice[invoice.id] || []
      const sentLog = invoiceLogs.find(l => l.chase_stage === nextStageId && l.status === 'sent')
      const checkInLog = invoiceLogs.find(l => l.chase_stage === nextStageId && l.status === 'check_in_sent')

      // Chase already sent for this stage, or check-in already sent — nothing to do today
      if (sentLog || checkInLog) { results.skipped++; continue }

      // No check-in sent yet — send one to the freelancer asking for approval
      const checkInEmail = buildCheckInEmail(invoice, profile, nextStageId)

      await sendViaResend({
        from: 'Hielda <notifications@hielda.com>',
        to: [profile.email],
        subject: checkInEmail.subject,
        html: checkInEmail.html,
      })

      await supabase.from('chase_log').insert({
        invoice_id: invoice.id,
        user_id: invoice.user_id,
        chase_stage: nextStageId,
        email_to: profile.email,
        status: 'check_in_sent',
      })

      results.check_ins_sent++
    } catch (e) {
      console.error(`[auto-chase] Error on invoice ${invoice.id}:`, e.message)
      errors.push({ invoice_id: invoice.id, error: e.message })
      results.errors++
    }
  }

  return res.status(200).json({
    success: true,
    ...results,
    ...(errors.length > 0 ? { error_detail: errors } : {}),
  })
}
