import { getRate, CHASE_STAGES } from "../constants"
import { fmt, formatDate, daysLate, calcInterest, penalty, round2 } from "../utils"
import { friendlySubject, friendlyBody, legalSubject, legalBody } from "./toneModifiers"

/**
 * Generate chase email HTML for a given stage.
 * Used both client-side (preview) and server-side (sending).
 * All 31 stages are supported (19 original + 12 recovery).
 * @param {string} tone - 'friendly', 'firm' (default), or 'legal'
 */
export function buildChaseEmail(invoice, profile, stage, tone = 'firm') {
  const dl = daysLate(invoice.due_date)
  const finesEnabled = !invoice.no_fines
  const interest = finesEnabled ? calcInterest(Number(invoice.amount), dl) : 0
  const pen = finesEnabled ? penalty(Number(invoice.amount)) : 0
  const total = round2(Number(invoice.amount) + interest + pen)

  const stageConfig = CHASE_STAGES.find((s) => s.id === stage)
  const fromName = profile.business_name || profile.full_name || "Hielda User"
  const lineBlock = lineItemsBlock(invoice)
  const payBlock = paymentDetailsBlock(invoice, profile)

  const interestTable = `
    ${lineBlock}
    <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:7px 16px 7px 0;color:#64748b;">Original invoice</td><td style="padding:6px 0;font-weight:600;">${fmt(invoice.amount)}</td></tr>
      <tr><td style="padding:7px 16px 7px 0;color:#64748b;">Fixed penalty</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(pen)}</td></tr>
      <tr><td style="padding:7px 16px 7px 0;color:#64748b;">Interest (${dl} days at ${getRate()}% p.a.)</td><td style="padding:6px 0;font-weight:600;color:#a16207;">+${fmt(interest)}</td></tr>
      <tr style="border-top:2px solid #1e5fa0;"><td style="padding:10px 16px 6px 0;font-weight:700;">TOTAL NOW OWED</td><td style="padding:10px 0 6px;font-weight:700;font-size:16px;color:#1e5fa0;">${fmt(total)}</td></tr>
    </table>`

  const totalBlock = `
    ${lineBlock}
    <div style="background:#fef2f2;border-left:4px solid #9f1239;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
      <div style="font-size:12px;color:#9f1239;font-weight:600;margin-bottom:4px;">TOTAL NOW OWED</div>
      <div style="font-size:24px;font-weight:700;color:#9f1239;">${fmt(total)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Original: ${fmt(invoice.amount)} + Penalty: ${fmt(pen)} + Interest: ${fmt(interest)}</div>
    </div>`

  const poRef = invoice.client_ref ? ` (${invoice.client_ref})` : ""

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
    recovery_1: `RECOVERY: Invoice ${invoice.ref}${poRef} — ${fmt(total)} overdue, 14 days to settle`,
    recovery_2: `RECOVERY: Invoice ${invoice.ref}${poRef} — ${fmt(total)} overdue, 12 days to settle`,
    recovery_3: `RECOVERY: Invoice ${invoice.ref}${poRef} — ${fmt(total)} overdue, 10 days to settle`,
    recovery_4: `RECOVERY: Invoice ${invoice.ref}${poRef} — ${fmt(total)} overdue, 8 days to settle`,
    recovery_5: `URGENT: Invoice ${invoice.ref}${poRef} — 7 days until formal recovery referral`,
    recovery_6: `URGENT: Invoice ${invoice.ref}${poRef} — 6 days until formal recovery referral`,
    recovery_7: `URGENT: Invoice ${invoice.ref}${poRef} — 5 days until formal recovery referral`,
    recovery_8: `URGENT: Invoice ${invoice.ref}${poRef} — 4 days until formal recovery referral`,
    recovery_9: `URGENT: Invoice ${invoice.ref}${poRef} — 3 days until formal recovery referral`,
    recovery_10: `URGENT: Invoice ${invoice.ref}${poRef} — 2 days until formal recovery referral`,
    recovery_11: `URGENT: Invoice ${invoice.ref}${poRef} — TOMORROW: formal recovery referral`,
    recovery_final: `REFERRED: Invoice ${invoice.ref}${poRef} — ${fmt(total)} now subject to formal recovery`,
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
      <p>If payment is not received by end of business today, we will be entitled to add statutory interest and a fixed penalty under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>.</p>
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
    recovery_1: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FINAL RECOVERY PERIOD — You have 14 days to settle this debt.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is now <strong>${dl} days overdue</strong>. This is the start of a final 15-day recovery period. If this debt is not settled by the end of this period, the creditor may refer this matter for formal recovery.</p>
      ${totalBlock}
      <p>The amount above reflects statutory interest accruing daily. The longer this remains unpaid, the more you will owe. Please settle <strong>${fmt(total)}</strong> immediately.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_2: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>RECOVERY NOTICE — 12 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. You have <strong>12 days</strong> to settle before the creditor may refer this matter for formal recovery.</p>
      ${totalBlock}
      <p>The total owed is <strong>${fmt(total)}</strong> and continues to increase daily. Please arrange payment without further delay.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_3: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>RECOVERY NOTICE — 10 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. You have <strong>10 days</strong> to settle before the creditor may refer this matter for formal recovery.</p>
      ${totalBlock}
      <p>Please pay <strong>${fmt(total)}</strong> immediately. Formal recovery may include County Court proceedings, which could adversely affect your credit rating.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_4: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>RECOVERY NOTICE — 8 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. You have <strong>8 days</strong> before this matter may be referred for formal recovery.</p>
      ${totalBlock}
      <p>This is your opportunity to resolve this without court involvement. Please settle <strong>${fmt(total)}</strong> today.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_5: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>IMMINENT ESCALATION — 7 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. From today, you will receive daily notices. You have <strong>7 days</strong> before this matter may be referred for formal recovery.</p>
      ${totalBlock}
      <p>Please settle <strong>${fmt(total)}</strong> immediately to avoid escalation.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_6: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>IMMINENT ESCALATION — 6 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. The amount owed is now <strong>${fmt(total)}</strong> and rising daily.</p>
      ${totalBlock}
      <p>You have <strong>6 days</strong> to pay before the creditor may commence formal recovery proceedings.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_7: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>IMMINENT ESCALATION — 5 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. <strong>${fmt(total)}</strong> remains outstanding.</p>
      ${totalBlock}
      <p><strong>5 days</strong> remain before the creditor may refer this debt for formal recovery, which may include court proceedings.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_8: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>IMMINENT ESCALATION — 4 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. The total owed is now <strong>${fmt(total)}</strong>.</p>
      ${totalBlock}
      <p>You have <strong>4 days</strong> to settle. We strongly urge you to pay immediately.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_9: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>IMMINENT ESCALATION — 3 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> — <strong>${dl} days overdue</strong>. <strong>${fmt(total)}</strong> is owed.</p>
      ${totalBlock}
      <p><strong>3 days</strong> remain. The creditor may pursue formal debt recovery including County Court proceedings if this is not settled.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_10: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>IMMINENT ESCALATION — 2 days remaining.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. <strong>${fmt(total)}</strong> remains unpaid.</p>
      ${totalBlock}
      <p>You have <strong>2 days</strong> before formal recovery may begin. This is one of your final opportunities to settle without court involvement.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_11: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FINAL WARNING — formal recovery referral TOMORROW.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. <strong>${fmt(total)}</strong> is owed.</p>
      ${totalBlock}
      <p><strong>Tomorrow, this matter may be referred for formal recovery.</strong> This is your last chance to settle without the creditor pursuing court proceedings or debt recovery agencies, which could affect your credit rating.</p>
      ${payBlock}
      <p>Regards,<br/>${fromName}</p>
    `,
    recovery_final: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL RECOVERY REFERRAL — Recovery period ended.</strong></p>
      <p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. Despite 45 days of correspondence and multiple opportunities to settle, payment has not been received.</p>
      ${totalBlock}
      <p>The final recovery period has now ended. The creditor may now pursue this debt through formal channels, which may include:</p>
      <ul style="margin:12px 0;padding-left:20px;color:#0f172a;">
        <li>Referral to a debt recovery agency</li>
        <li>County Court proceedings (which may result in a CCJ on your credit record)</li>
        <li>Statutory interest continuing to accrue until the debt is settled in full</li>
      </ul>
      <p>If you wish to settle this debt to avoid formal proceedings, please pay <strong>${fmt(total)}</strong> immediately using the details below.</p>
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
    subject = subjects[stage]
    body = bodies[stage]
  }

  if (!subject || !body) return null

  return {
    subject,
    html: wrapInLayout(body, stageConfig),
    to: invoice.client_email,
    from_name: fromName,
  }
}

function lineItemsBlock(invoice) {
  if (!invoice.line_items?.length) return ""
  const rows = invoice.line_items.map(li =>
    `<tr style="border-bottom:1px solid #e8ecf0;">
      <td style="padding:7px 16px 7px 0;color:#374151;font-size:13px;">${li.description}</td>
      <td style="padding:6px 0;font-size:13px;text-align:right;font-weight:500;font-family:monospace;">${fmt(li.amount)}</td>
    </tr>`
  ).join("")
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
        Account Name: ${profile.account_name || "—"}<br/>
        Bank: ${profile.bank_name || "—"}<br/>
        Sort Code: ${profile.sort_code || "—"}<br/>
        Account: ${profile.account_number || "—"}<br/>
        Reference: ${invoice.ref}${invoice.client_ref ? `<br/>Your ref: ${invoice.client_ref}` : ""}
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
          Sent via <a href="https://hielda.com?ref=chase-email" style="color:#1e5fa0;text-decoration:none;font-weight:600;">Hielda</a> — Late payment enforcement for freelancers & SMEs.
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Get the appropriate chase stage for an invoice based on days from due date.
 * daysOverdue is negative before due, 0 on due date, positive after.
 * Returns the highest stage whose dfd (days from due) is <= daysOverdue.
 */
export function getChaseStageForDays(daysOverdue) {
  // Walk stages in reverse to find the first stage whose trigger day has been reached
  for (let i = CHASE_STAGES.length - 1; i >= 0; i--) {
    if (CHASE_STAGES[i].dfd <= daysOverdue) return CHASE_STAGES[i].id
  }
  // If before the earliest stage trigger, return the earliest stage
  if (daysOverdue <= CHASE_STAGES[0].dfd) return CHASE_STAGES[0].id
  return null
}
