import { RATE, CHASE_STAGES } from "../constants"
import { fmt, formatDate, daysLate, calcInterest, penalty } from "../utils"

/**
 * Generate chase email HTML for a given stage.
 * Used both client-side (preview) and server-side (sending).
 */
export function buildChaseEmail(invoice, profile, stage) {
  const dl = daysLate(invoice.due_date)
  const interest = calcInterest(Number(invoice.amount), dl)
  const pen = penalty(Number(invoice.amount))
  const total = Number(invoice.amount) + interest + pen

  const stageConfig = CHASE_STAGES.find((s) => s.id === stage)
  const fromName = profile.business_name || profile.full_name || "Hielda User"

  const templates = {
    reminder_1: {
      subject: `Payment reminder: Invoice ${invoice.ref} — ${fmt(invoice.amount)}`,
      body: `
        <p>Dear ${invoice.client_name},</p>
        <p>This is a friendly reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due on <strong>${formatDate(invoice.due_date)}</strong>.</p>
        <p>Please ensure payment is made by the due date to avoid any late payment charges.</p>
        ${paymentDetailsBlock(invoice, profile)}
        <p>If you've already made payment, please disregard this message.</p>
        <p>Kind regards,<br/>${fromName}</p>
      `,
    },
    reminder_2: {
      subject: `Upcoming: Invoice ${invoice.ref} due tomorrow — ${fmt(invoice.amount)}`,
      body: `
        <p>Dear ${invoice.client_name},</p>
        <p>This is a reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due <strong>tomorrow</strong> (${formatDate(invoice.due_date)}).</p>
        <p>Under the Late Payment of Commercial Debts (Interest) Act 1998, interest and penalties will be applied if payment is not received by the due date.</p>
        ${paymentDetailsBlock(invoice, profile)}
        <p>Kind regards,<br/>${fromName}</p>
      `,
    },
    first_chase: {
      subject: `OVERDUE: Invoice ${invoice.ref} — payment required`,
      body: `
        <p>Dear ${invoice.client_name},</p>
        <p>Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> was due on <strong>${formatDate(invoice.due_date)}</strong> and remains unpaid.</p>
        <p>Under the Late Payment of Commercial Debts (Interest) Act 1998, we are entitled to charge interest at <strong>${RATE}% per annum</strong> and a fixed penalty. Interest is now accruing on this debt.</p>
        <p>Please arrange payment immediately.</p>
        ${paymentDetailsBlock(invoice, profile)}
        <p>Regards,<br/>${fromName}</p>
      `,
    },
    second_chase: {
      subject: `OVERDUE: Invoice ${invoice.ref} — ${fmt(total)} now owed (interest applied)`,
      body: `
        <p>Dear ${invoice.client_name},</p>
        <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong>. Under the Late Payment of Commercial Debts (Interest) Act 1998, the following charges have been applied:</p>
        <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Original invoice</td><td style="padding:6px 0;font-weight:600;">${fmt(invoice.amount)}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Fixed penalty</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(pen)}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#64748b;">Interest (${dl} days at ${RATE}% p.a.)</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(interest)}</td></tr>
          <tr style="border-top:2px solid #1e5fa0;"><td style="padding:10px 16px 6px 0;font-weight:700;">TOTAL NOW OWED</td><td style="padding:10px 0 6px;font-weight:700;font-size:16px;color:#1e5fa0;">${fmt(total)}</td></tr>
        </table>
        <p>Please settle this amount immediately to prevent further charges.</p>
        ${paymentDetailsBlock(invoice, profile)}
        <p>Regards,<br/>${fromName}</p>
      `,
    },
    final_notice: {
      subject: `FINAL NOTICE: Invoice ${invoice.ref} — ${fmt(total)} overdue. Legal action pending.`,
      body: `
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
        ${paymentDetailsBlock(invoice, profile)}
        <p>Regards,<br/>${fromName}</p>
      `,
    },
  }

  const template = templates[stage]
  if (!template) return null

  return {
    subject: template.subject,
    html: wrapInLayout(template.body, stageConfig),
    to: invoice.client_email,
    from_name: fromName,
  }
}

function paymentDetailsBlock(invoice, profile) {
  return `
    <div style="background:#f1f3f6;padding:14px 18px;border-radius:8px;margin:16px 0;font-size:13px;">
      <div style="font-weight:600;color:#0f172a;margin-bottom:6px;">Payment Details</div>
      <div style="color:#64748b;">
        Bank: ${profile.bank_name || "—"}<br/>
        Sort Code: ${profile.sort_code || "—"}<br/>
        Account: ${profile.account_number || "—"}<br/>
        Reference: ${invoice.ref}
      </div>
    </div>
  `
}

function wrapInLayout(bodyHtml, stageConfig) {
  const stageColor = stageConfig?.col || "#1e5fa0"
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
    <body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
          <div style="background:${stageColor};padding:16px 24px;">
            <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
          </div>
          <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
            ${bodyHtml}
          </div>
        </div>
        <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
          Sent via Hielda — Protecting your pay.
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Get the next chase stage for an invoice based on days overdue.
 */
export function getChaseStageForDays(daysOverdue, dueDate) {
  // Pre-due reminders
  if (daysOverdue <= -5) return "reminder_1"
  if (daysOverdue <= -1) return "reminder_2"
  // Post-due chasing
  if (daysOverdue >= 30) return "final_notice"
  if (daysOverdue >= 14) return "second_chase"
  if (daysOverdue >= 1) return "first_chase"
  return null
}
