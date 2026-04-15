import { getRate } from "../constants"
import { fmt, formatDate, penalty } from "../utils"

/**
 * Tone modifiers for chase emails.
 *
 * Each tone function receives the same context object and returns { subject, bodyHtml }.
 * The bodyHtml contains ONLY the text/paragraph content — the caller is responsible for
 * wrapping it in the HTML layout, and for inserting interestTable / totalBlock / payBlock / lineBlock.
 *
 * "firm" tone uses the existing hardcoded templates in emailTemplates.js — no modifier needed.
 */

// ── Friendly tone ──────────────────────────────────────────────────────────────

export function friendlySubject(stage, { invoice, total, dl, poRef }) {
  const ref = invoice.ref
  const amt = fmt(invoice.amount)
  const t = fmt(total)
  const subjects = {
    reminder_1:    `Just a heads-up: Invoice ${ref}${poRef} for ${amt} is coming up`,
    reminder_2:    `Quick reminder: Invoice ${ref}${poRef} is due tomorrow — ${amt}`,
    final_warning: `Reminder: Invoice ${ref}${poRef} for ${amt} is due today`,
    first_chase:   `Following up: Invoice ${ref}${poRef} — ${t} now due`,
    second_chase:  `Checking in: Invoice ${ref}${poRef} — ${dl} days past due`,
    third_chase:   `Another reminder: Invoice ${ref}${poRef} — ${t} outstanding`,
    chase_4:       `Following up again: Invoice ${ref}${poRef} — ${t} overdue`,
    chase_5:       `Friendly nudge: Invoice ${ref}${poRef} — payment needed`,
    chase_6:       `Still outstanding: Invoice ${ref}${poRef} — ${t} due`,
    chase_7:       `Checking in again: Invoice ${ref}${poRef} — ${t} overdue`,
    chase_8:       `Reminder: Invoice ${ref}${poRef} — ${dl} days outstanding`,
    chase_9:       `Following up: Invoice ${ref}${poRef} — payment request`,
    chase_10:      `Gentle reminder: Invoice ${ref}${poRef} — ${t} outstanding`,
    chase_11:      `Important: Invoice ${ref}${poRef} — last reminder before next steps`,
    escalation_1:  `Action needed: Invoice ${ref}${poRef} — 4 days to resolve`,
    escalation_2:  `Please respond: Invoice ${ref}${poRef} — 3 days remaining`,
    escalation_3:  `Urgent: Invoice ${ref}${poRef} — 2 days to resolve this`,
    escalation_4:  `Final day: Invoice ${ref}${poRef} — please settle tomorrow`,
    final_notice:  `Final notice: Invoice ${ref}${poRef} — ${t} overdue, next steps pending`,
    recovery_1:    `Important: Invoice ${ref}${poRef} — ${t} overdue, 14 days to resolve`,
    recovery_2:    `Following up: Invoice ${ref}${poRef} — ${t} overdue, 12 days remaining`,
    recovery_3:    `Please respond: Invoice ${ref}${poRef} — ${t} overdue, 10 days remaining`,
    recovery_4:    `Action needed: Invoice ${ref}${poRef} — ${t} overdue, 8 days remaining`,
    recovery_5:    `Urgent: Invoice ${ref}${poRef} — 7 days until next steps`,
    recovery_6:    `Urgent: Invoice ${ref}${poRef} — 6 days remaining to resolve`,
    recovery_7:    `Urgent: Invoice ${ref}${poRef} — 5 days remaining`,
    recovery_8:    `Urgent: Invoice ${ref}${poRef} — 4 days remaining to settle`,
    recovery_9:    `Please act now: Invoice ${ref}${poRef} — 3 days remaining`,
    recovery_10:   `Urgent: Invoice ${ref}${poRef} — 2 days remaining`,
    recovery_11:   `Final day: Invoice ${ref}${poRef} — next steps begin tomorrow`,
    recovery_final: `Update: Invoice ${ref}${poRef} — ${t} overdue, recovery period ended`,
  }
  return subjects[stage]
}

export function friendlyBody(stage, { invoice, profile, dl, total, interest, pen, fromName, interestTable, totalBlock, lineBlock, payBlock }) {
  const ref = invoice.ref
  const amt = fmt(invoice.amount)
  const t = fmt(total)
  const dueDate = formatDate(invoice.due_date)

  const bodies = {
    reminder_1: `
      <p>Hi ${invoice.client_name},</p>
      <p>Just a gentle reminder that invoice <strong>${ref}</strong> for <strong>${amt}</strong> is due by <strong>${dueDate}</strong>. No rush — just wanted to make sure it's on your radar.</p>
      <div style="background:#f0f7ff;border-left:3px solid #1e5fa0;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:13px;color:#1e3a5f;">
        Please note that after <strong>${dueDate}</strong>, statutory interest and penalties may apply under UK law. We'd love to get this wrapped up before then.
      </div>
      ${lineBlock}
      ${payBlock}
      <p>If you've already sent payment, please ignore this — and thank you!</p>
      <p>Warm regards,<br/>${fromName}</p>
    `,
    reminder_2: `
      <p>Hi ${invoice.client_name},</p>
      <p>Just a quick note — invoice <strong>${ref}</strong> for <strong>${amt}</strong> is due <strong>tomorrow</strong> (${dueDate}). We understand things can get busy, so this is just a friendly heads-up.</p>
      <div style="background:#f0f7ff;border-left:3px solid #1e5fa0;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:13px;color:#1e3a5f;">
        After <strong>${dueDate}</strong>, statutory interest and penalties will apply. Settling before then avoids any extra charges.
      </div>
      ${lineBlock}
      ${payBlock}
      <p>Warm regards,<br/>${fromName}</p>
    `,
    final_warning: `
      <p>Hi ${invoice.client_name},</p>
      <p>We hope you're well. Just a reminder that invoice <strong>${ref}</strong> for <strong>${amt}</strong> is due <strong>today</strong> (${dueDate}).</p>
      <p>We value our working relationship and wanted to let you know that this is the last day to settle at the original amount. From tomorrow, statutory interest and a fixed penalty will be added automatically.</p>
      ${lineBlock}
      ${payBlock}
      <p>If there's any issue with payment, please don't hesitate to get in touch — we're happy to discuss.</p>
      <p>Kind regards,<br/>${fromName}</p>
    `,
    first_chase: `
      <p>Hi ${invoice.client_name},</p>
      <p>We hope everything is okay. Invoice <strong>${ref}</strong> for <strong>${amt}</strong> was due by <strong>${dueDate}</strong> and we haven't received payment yet.</p>
      <p>As we mentioned, statutory charges have now been applied. Here's the updated position:</p>
      ${interestTable}
      <p>We'd really appreciate it if you could arrange payment of <strong>${t}</strong> when you get a chance. Interest does continue to accrue daily, so the sooner the better.</p>
      ${payBlock}
      <p>If there's a reason for the delay, we're happy to chat about it.</p>
      <p>Kind regards,<br/>${fromName}</p>
    `,
    second_chase: `
      <p>Hi ${invoice.client_name},</p>
      <p>We're following up on invoice <strong>${ref}</strong>, which is now <strong>${dl} days past due</strong>. We understand that these things can sometimes slip through the cracks.</p>
      <p>The amount continues to grow under statutory rules:</p>
      ${interestTable}
      <p>Could you please let us know when we can expect payment? We'd love to get this resolved.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    third_chase: `
      <p>Hi ${invoice.client_name},</p>
      <p>This is our third message about invoice <strong>${ref}</strong>, now <strong>${dl} days overdue</strong>. We value our relationship and hope we can resolve this promptly.</p>
      <p>The current balance is <strong>${t}</strong> and continues to grow:</p>
      ${interestTable}
      <p>We'd be grateful if you could arrange payment or let us know if there's an issue we can help with.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    chase_4: `
      <p>Hi ${invoice.client_name},</p>
      <p>We're reaching out again about invoice <strong>${ref}</strong>, which has been outstanding for <strong>${dl} days</strong> now.</p>
      ${totalBlock}
      <p>We understand things happen, but we do need to resolve this. Could you please arrange payment or get in touch to discuss?</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    chase_5: `
      <p>Hi ${invoice.client_name},</p>
      <p>We're writing again about invoice <strong>${ref}</strong>, now <strong>${dl} days overdue</strong>. We've sent several reminders and would really appreciate a response.</p>
      ${totalBlock}
      <p>Please arrange payment of <strong>${t}</strong> at your earliest convenience. If there's a difficulty, we're open to discussing options.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    chase_6: `
      <p>Hi ${invoice.client_name},</p>
      <p>Invoice <strong>${ref}</strong> has been outstanding for <strong>${dl} days</strong> and we're becoming concerned. We'd like to resolve this without needing to take further steps.</p>
      ${totalBlock}
      <p>Please arrange payment of <strong>${t}</strong> or contact us to discuss. We'd prefer to work this out together.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    chase_7: `
      <p>Hi ${invoice.client_name},</p>
      <p>We've been trying to reach you about invoice <strong>${ref}</strong>, now <strong>${dl} days overdue</strong>. We'd really like to resolve this amicably.</p>
      ${totalBlock}
      <p>If payment of <strong>${t}</strong> isn't received soon, we may need to consider our next options. We'd much rather hear from you first.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    chase_8: `
      <p>Hi ${invoice.client_name},</p>
      <p>Invoice <strong>${ref}</strong> has now been outstanding for <strong>${dl} days</strong>. The amount owed continues to increase and we're keen to find a resolution.</p>
      ${totalBlock}
      <p>Please arrange payment or get in touch with us as soon as possible.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    chase_9: `
      <p>Hi ${invoice.client_name},</p>
      <p>We're following up once more on invoice <strong>${ref}</strong>, now <strong>${dl} days overdue</strong>. We've made several attempts to resolve this and would appreciate your prompt attention.</p>
      ${totalBlock}
      <p>Please arrange payment of <strong>${t}</strong> as soon as you can.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    chase_10: `
      <p>Hi ${invoice.client_name},</p>
      <p>Invoice <strong>${ref}</strong> remains unpaid after <strong>${dl} days</strong>. We've been patient and understanding, but we do need this resolved.</p>
      ${totalBlock}
      <p>Please arrange payment without further delay. We'd like to avoid having to take this further.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    chase_11: `
      <p>Hi ${invoice.client_name},</p>
      <p>This is our last reminder before we begin a more formal process regarding invoice <strong>${ref}</strong>, now <strong>${dl} days overdue</strong>.</p>
      ${totalBlock}
      <p>We sincerely hope to resolve this without escalation. If payment of <strong>${t}</strong> is received within the next 5 days, we can close this matter. Otherwise, you'll receive daily escalation notices.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    escalation_1: `
      <p>Hi ${invoice.client_name},</p>
      <p><strong>We need to let you know that escalation will begin in 4 days.</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong> and we've been unable to reach a resolution despite multiple attempts.</p>
      ${totalBlock}
      <p>We genuinely want to avoid formal proceedings, as they can be stressful for everyone involved. Please arrange payment or contact us within 4 days.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    escalation_2: `
      <p>Hi ${invoice.client_name},</p>
      <p><strong>3 days remain before we begin the formal recovery process.</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong>. We'd much rather settle this between us than involve third parties.</p>
      ${totalBlock}
      <p>Please get in touch or arrange payment within the next 3 days.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    escalation_3: `
      <p>Hi ${invoice.client_name},</p>
      <p><strong>There are 2 days remaining before formal action may be taken.</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong>. We're asking one more time for payment or contact before we proceed.</p>
      ${totalBlock}
      <p>We hope to hear from you.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    escalation_4: `
      <p>Hi ${invoice.client_name},</p>
      <p><strong>This is the final day to resolve this before we take further action.</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong>. If payment of <strong>${t}</strong> is not received by end of business tomorrow, we will need to begin formal recovery.</p>
      ${totalBlock}
      <p>We truly hope it doesn't come to that. Please get in touch today.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    final_notice: `
      <p>Hi ${invoice.client_name},</p>
      <p><strong>This is our final message before formal recovery proceedings may begin.</strong></p>
      <p>Invoice <strong>${ref}</strong> is now <strong>${dl} days overdue</strong>. Despite many attempts to resolve this amicably, payment has not been received.</p>
      ${totalBlock}
      <p>If payment of <strong>${t}</strong> is not received within <strong>7 days</strong>, we may need to refer this matter for formal recovery, which could include debt recovery agencies or County Court proceedings.</p>
      <p>We would much prefer to resolve this directly with you. Please get in touch.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_1: `
      <p>Hi ${invoice.client_name},</p>
      <p>We're reaching out again about invoice <strong>${ref}</strong>, now <strong>${dl} days overdue</strong>. We've entered a final 15-day recovery period, after which we may need to take further steps.</p>
      ${totalBlock}
      <p>We'd really prefer to resolve this between us. Could you please arrange payment of <strong>${t}</strong> or let us know what's going on? We have 14 days before we may need to involve third parties.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_2: `
      <p>Hi ${invoice.client_name},</p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong> and there are <strong>12 days</strong> left in the recovery period.</p>
      ${totalBlock}
      <p>The amount continues to grow and we'd love to get this sorted. Please arrange payment of <strong>${t}</strong> when you can.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_3: `
      <p>Hi ${invoice.client_name},</p>
      <p>We're following up on invoice <strong>${ref}</strong>, <strong>${dl} days overdue</strong>. There are <strong>10 days</strong> remaining before we may need to consider formal recovery.</p>
      ${totalBlock}
      <p>Please arrange payment or get in touch — we'd much rather work this out directly.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_4: `
      <p>Hi ${invoice.client_name},</p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong> with <strong>8 days</strong> left before further action may be needed.</p>
      ${totalBlock}
      <p>We understand things can be difficult, but we do need this resolved. Please settle <strong>${t}</strong> or contact us to discuss.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_5: `
      <p>Hi ${invoice.client_name},</p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong>. From today you'll receive daily updates as we have <strong>7 days</strong> remaining in the recovery period.</p>
      ${totalBlock}
      <p>Please arrange payment of <strong>${t}</strong> as soon as possible. We genuinely want to avoid involving third parties.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_6: `
      <p>Hi ${invoice.client_name},</p>
      <p>Just checking in — invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong> with <strong>6 days</strong> remaining.</p>
      ${totalBlock}
      <p>The amount owed is <strong>${t}</strong> and still growing. Please arrange payment or get in touch.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_7: `
      <p>Hi ${invoice.client_name},</p>
      <p><strong>5 days remaining.</strong> Invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong>.</p>
      ${totalBlock}
      <p>We're running out of time to resolve this between us. Please settle <strong>${t}</strong> or contact us today.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_8: `
      <p>Hi ${invoice.client_name},</p>
      <p><strong>4 days remaining.</strong> Invoice <strong>${ref}</strong> — <strong>${dl} days overdue</strong>, <strong>${t}</strong> owed.</p>
      ${totalBlock}
      <p>Please arrange payment. We'd hate for this to go further than it needs to.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_9: `
      <p>Hi ${invoice.client_name},</p>
      <p><strong>3 days remaining.</strong> Invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong>.</p>
      ${totalBlock}
      <p>Please settle <strong>${t}</strong> in the next 3 days to avoid the creditor needing to take further action.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_10: `
      <p>Hi ${invoice.client_name},</p>
      <p><strong>2 days remaining.</strong> Invoice <strong>${ref}</strong> — <strong>${dl} days overdue</strong>.</p>
      ${totalBlock}
      <p>This is one of the last opportunities to settle <strong>${t}</strong> before the creditor may pursue formal recovery. Please get in touch.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_11: `
      <p>Hi ${invoice.client_name},</p>
      <p><strong>Tomorrow the recovery period ends.</strong> Invoice <strong>${ref}</strong> is <strong>${dl} days overdue</strong> with <strong>${t}</strong> outstanding.</p>
      ${totalBlock}
      <p>This is your last chance to settle before the creditor may refer this for formal recovery. We sincerely hope to hear from you today.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
    recovery_final: `
      <p>Hi ${invoice.client_name},</p>
      <p>The recovery period for invoice <strong>${ref}</strong> has now ended. It has been <strong>${dl} days</strong> since this invoice was due, and despite many attempts to resolve this, payment of <strong>${t}</strong> has not been received.</p>
      ${totalBlock}
      <p>The creditor may now consider referring this matter for formal recovery. If you'd like to settle to avoid this, please pay <strong>${t}</strong> using the details below.</p>
      ${payBlock}
      <p>Kind regards,<br/>${fromName}</p>
    `,
  }
  return bodies[stage]
}

// ── Legal tone ─────────────────────────────────────────────────────────────────

export function legalSubject(stage, { invoice, total, dl, poRef }) {
  const ref = invoice.ref
  const amt = fmt(invoice.amount)
  const t = fmt(total)
  const subjects = {
    reminder_1:    `FORMAL REMINDER: Invoice ${ref}${poRef} — ${amt} due shortly`,
    reminder_2:    `NOTICE: Invoice ${ref}${poRef} — ${amt} due tomorrow`,
    final_warning: `FINAL NOTICE BEFORE CHARGES: Invoice ${ref}${poRef} — ${amt} due today`,
    first_chase:   `STATUTORY DEMAND: Invoice ${ref}${poRef} — ${t} now payable`,
    second_chase:  `STATUTORY DEMAND: Invoice ${ref}${poRef} — ${dl} days in arrears, ${t} owed`,
    third_chase:   `FORMAL DEMAND: Invoice ${ref}${poRef} — ${t} outstanding`,
    chase_4:       `STATUTORY DEMAND: Invoice ${ref}${poRef} — ${t} in arrears`,
    chase_5:       `FORMAL DEMAND: Invoice ${ref}${poRef} — immediate settlement required`,
    chase_6:       `STATUTORY DEMAND: Invoice ${ref}${poRef} — ${t} outstanding debt`,
    chase_7:       `FORMAL DEMAND: Invoice ${ref}${poRef} — ${t} in arrears`,
    chase_8:       `STATUTORY DEMAND: Invoice ${ref}${poRef} — ${dl} days, ${t} owed`,
    chase_9:       `FORMAL DEMAND FOR PAYMENT: Invoice ${ref}${poRef}`,
    chase_10:      `STATUTORY DEMAND: Invoice ${ref}${poRef} — ${t} outstanding`,
    chase_11:      `FINAL DEMAND: Invoice ${ref}${poRef} — pre-action notice`,
    escalation_1:  `PRE-ACTION NOTICE: Invoice ${ref}${poRef} — 4 days to comply`,
    escalation_2:  `PRE-ACTION NOTICE: Invoice ${ref}${poRef} — 3 days to comply`,
    escalation_3:  `PRE-ACTION NOTICE: Invoice ${ref}${poRef} — 2 days to comply`,
    escalation_4:  `PRE-ACTION NOTICE: Invoice ${ref}${poRef} — final day to comply`,
    final_notice:  `LETTER BEFORE ACTION: Invoice ${ref}${poRef} — ${t} overdue. Proceedings imminent.`,
    recovery_1:    `FORMAL RECOVERY NOTICE: Invoice ${ref}${poRef} — ${t} in arrears, 14 days to comply`,
    recovery_2:    `FORMAL RECOVERY NOTICE: Invoice ${ref}${poRef} — ${t} in arrears, 12 days to comply`,
    recovery_3:    `FORMAL RECOVERY NOTICE: Invoice ${ref}${poRef} — ${t} in arrears, 10 days to comply`,
    recovery_4:    `FORMAL RECOVERY NOTICE: Invoice ${ref}${poRef} — ${t} in arrears, 8 days to comply`,
    recovery_5:    `IMMINENT PROCEEDINGS: Invoice ${ref}${poRef} — 7 days to comply`,
    recovery_6:    `IMMINENT PROCEEDINGS: Invoice ${ref}${poRef} — 6 days to comply`,
    recovery_7:    `IMMINENT PROCEEDINGS: Invoice ${ref}${poRef} — 5 days to comply`,
    recovery_8:    `IMMINENT PROCEEDINGS: Invoice ${ref}${poRef} — 4 days to comply`,
    recovery_9:    `IMMINENT PROCEEDINGS: Invoice ${ref}${poRef} — 3 days to comply`,
    recovery_10:   `IMMINENT PROCEEDINGS: Invoice ${ref}${poRef} — 2 days to comply`,
    recovery_11:   `IMMINENT PROCEEDINGS: Invoice ${ref}${poRef} — final day to comply`,
    recovery_final: `NOTICE OF REFERRAL: Invoice ${ref}${poRef} — ${t} referred for formal recovery`,
  }
  return subjects[stage]
}

export function legalBody(stage, { invoice, profile, dl, total, interest, pen, fromName, interestTable, totalBlock, lineBlock, payBlock }) {
  const ref = invoice.ref
  const amt = fmt(invoice.amount)
  const t = fmt(total)
  const dueDate = formatDate(invoice.due_date)
  const creditor = profile.business_name || profile.full_name || "the creditor"

  const bodies = {
    reminder_1: `
      <p>Dear ${invoice.client_name},</p>
      <p>This letter serves as formal notice that invoice <strong>${ref}</strong> in the sum of <strong>${amt}</strong> is due for payment by <strong>${dueDate}</strong>.</p>
      <div style="background:#f0f7ff;border-left:3px solid #1e5fa0;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:13px;color:#1e3a5f;">
        Under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>, the creditor is entitled to claim statutory interest at ${getRate()}% per annum and a fixed penalty of <strong>${fmt(penalty(Number(invoice.amount)))}</strong> on any sum not paid by the contractual due date. Payment by <strong>${dueDate}</strong> will avoid these charges.
      </div>
      ${lineBlock}
      ${payBlock}
      <p>If payment has already been remitted, please disregard this notice.</p>
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    reminder_2: `
      <p>Dear ${invoice.client_name},</p>
      <p>This is formal notice that invoice <strong>${ref}</strong> in the sum of <strong>${amt}</strong> falls due for payment <strong>tomorrow</strong> (${dueDate}).</p>
      <div style="background:#f0f7ff;border-left:3px solid #1e5fa0;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:13px;color:#1e3a5f;">
        Failure to pay by <strong>${dueDate}</strong> will entitle the creditor to statutory interest and a fixed penalty under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>.
      </div>
      ${lineBlock}
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    final_warning: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>NOTICE:</strong> Invoice <strong>${ref}</strong> in the sum of <strong>${amt}</strong> is due for payment <strong>today</strong> (${dueDate}).</p>
      <p>This is the final date on which this debt may be settled at the original sum of <strong>${amt}</strong>.</p>
      <p>From tomorrow, ${creditor} will exercise the statutory right to charge interest at ${getRate()}% per annum and a fixed penalty under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>. The total sum owed will increase accordingly.</p>
      ${lineBlock}
      ${payBlock}
      <p>Govern yourself accordingly.</p>
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    first_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>STATUTORY DEMAND FOR PAYMENT</strong></p>
      <p>Invoice <strong>${ref}</strong> in the sum of <strong>${amt}</strong> was due by <strong>${dueDate}</strong> and remains unpaid.</p>
      <p>Pursuant to the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>, the following statutory charges have been applied to the outstanding debt:</p>
      ${interestTable}
      <p>The debtor is hereby required to remit the sum of <strong>${t}</strong> without further delay. Interest continues to accrue at a daily rate.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    second_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>SECOND STATUTORY DEMAND</strong></p>
      <p>Invoice <strong>${ref}</strong> is now <strong>${dl} days in arrears</strong>. Payment has not been received despite prior written demand.</p>
      <p>The debt continues to accrue interest under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>:</p>
      ${interestTable}
      <p>The debtor is required to settle the sum of <strong>${t}</strong> immediately.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    third_chase: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>THIRD AND FORMAL DEMAND</strong></p>
      <p>This constitutes the third written demand for payment of invoice <strong>${ref}</strong>, now <strong>${dl} days in arrears</strong>.</p>
      <p>The outstanding balance stands at <strong>${t}</strong> and increases daily:</p>
      ${interestTable}
      <p>The creditor reserves all rights under the Late Payment of Commercial Debts (Interest) Act 1998 and at common law. Settle this debt without further delay.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    chase_4: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL DEMAND — FOURTH NOTICE</strong></p>
      <p>Invoice <strong>${ref}</strong> has been outstanding for <strong>${dl} days</strong>. Multiple written demands have been issued and ignored.</p>
      ${totalBlock}
      <p>The debtor is put on notice that continued failure to pay may result in the creditor commencing debt recovery proceedings.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    chase_5: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL DEMAND — FIFTH NOTICE</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>.</p>
      ${totalBlock}
      <p>Immediate settlement of <strong>${t}</strong> is required. The creditor reserves the right to refer this matter for formal recovery without further notice.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    chase_6: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL DEMAND — SIXTH NOTICE</strong></p>
      <p>Invoice <strong>${ref}</strong> has been outstanding for <strong>${dl} days</strong>. This matter is now considered seriously in arrears.</p>
      ${totalBlock}
      <p>The debtor is required to remit <strong>${t}</strong> without further delay. Failure to do so may result in escalation to formal proceedings.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    chase_7: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL DEMAND — SEVENTH NOTICE</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. Repeated demands have been disregarded.</p>
      ${totalBlock}
      <p>If payment of <strong>${t}</strong> is not received forthwith, the creditor will proceed to the next stage of recovery.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    chase_8: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL DEMAND — EIGHTH NOTICE</strong></p>
      <p>Invoice <strong>${ref}</strong> has been in arrears for <strong>${dl} days</strong>. The debt increases daily under statute.</p>
      ${totalBlock}
      <p>Immediate payment is demanded.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    chase_9: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL DEMAND FOR PAYMENT — NINTH NOTICE</strong></p>
      <p>This constitutes a further demand for the outstanding sum due under invoice <strong>${ref}</strong>, now <strong>${dl} days in arrears</strong>.</p>
      ${totalBlock}
      <p>Numerous written demands have been served. The debtor is required to make payment immediately.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    chase_10: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL DEMAND — TENTH NOTICE</strong></p>
      <p>Invoice <strong>${ref}</strong> remains outstanding after <strong>${dl} days</strong>. Statutory interest continues to accrue under the Late Payment of Commercial Debts (Interest) Act 1998.</p>
      ${totalBlock}
      <p>Payment is demanded without further delay.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    chase_11: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FINAL DEMAND BEFORE PRE-ACTION PROTOCOL</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>.</p>
      ${totalBlock}
      <p>This is the final demand before the creditor initiates the Pre-Action Protocol for Debt Claims. If payment of <strong>${t}</strong> is not received within 5 days, formal escalation proceedings will commence. Daily notices will follow.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    escalation_1: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>PRE-ACTION NOTICE — 4 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. The debtor has <strong>4 days</strong> to settle the outstanding sum before the creditor commences formal debt recovery proceedings.</p>
      ${totalBlock}
      <p>In accordance with the Pre-Action Protocol for Debt Claims, formal recovery may include a County Court Judgement (CCJ), which will be recorded on the debtor's credit file for six years, and referral to certificated enforcement agents.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    escalation_2: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>PRE-ACTION NOTICE — 3 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. The debtor has <strong>3 days</strong> to comply before the creditor initiates County Court proceedings.</p>
      ${totalBlock}
      <p>This is the debtor's opportunity to resolve this matter without a County Court Judgement being entered.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    escalation_3: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>PRE-ACTION NOTICE — 2 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. The debtor has <strong>2 days</strong> remaining before the creditor files a claim.</p>
      ${totalBlock}
      <p>The creditor strongly advises the debtor to settle this debt immediately to avoid formal proceedings and the associated costs.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    escalation_4: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>PRE-ACTION NOTICE — FINAL DAY TO COMPLY</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. If payment of <strong>${t}</strong> is not received by close of business <strong>tomorrow</strong>, the creditor will commence formal proceedings without further notice.</p>
      ${totalBlock}
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    final_notice: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>LETTER BEFORE ACTION</strong></p>
      <p>This letter constitutes formal notice under the Pre-Action Protocol for Debt Claims in respect of invoice <strong>${ref}</strong>, now <strong>${dl} days in arrears</strong>.</p>
      ${totalBlock}
      <p>If payment of <strong>${t}</strong> is not received within <strong>7 days</strong> of the date of this notice, the creditor intends to issue proceedings in the County Court without further reference to the debtor. A County Court Judgement (CCJ) will be entered and recorded on the debtor's credit file. The creditor will also seek recovery of all court fees and costs.</p>
      <p>The debtor is advised to seek independent legal advice.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_1: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL RECOVERY NOTICE — 14 DAYS TO COMPLY</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. The creditor hereby commences a final 15-day recovery period, pursuant to the Pre-Action Protocol for Debt Claims.</p>
      ${totalBlock}
      <p>If the sum of <strong>${t}</strong> is not received within 14 days, the creditor may issue proceedings in the County Court without further notice. The debtor will be liable for all court fees and costs in addition to the debt.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_2: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL RECOVERY NOTICE — 12 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. The debtor has <strong>12 days</strong> to settle the outstanding sum before the creditor may commence formal proceedings.</p>
      ${totalBlock}
      <p>The debtor is required to remit <strong>${t}</strong> immediately.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_3: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL RECOVERY NOTICE — 10 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. <strong>10 days</strong> remain before the creditor may file a claim in the County Court.</p>
      ${totalBlock}
      <p>A County Court Judgement (CCJ) will be recorded on the debtor's credit file for six years. The debtor is urged to settle <strong>${t}</strong> without delay.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_4: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FORMAL RECOVERY NOTICE — 8 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. The debtor has <strong>8 days</strong> to comply before proceedings may be issued.</p>
      ${totalBlock}
      <p>Settlement of <strong>${t}</strong> is required immediately to avoid formal proceedings and associated costs.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_5: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>NOTICE OF IMMINENT PROCEEDINGS — 7 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. From this date, daily notices will be served. The debtor has <strong>7 days</strong> before proceedings may be issued.</p>
      ${totalBlock}
      <p>The debtor is required to remit <strong>${t}</strong> forthwith.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_6: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>NOTICE OF IMMINENT PROCEEDINGS — 6 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> — <strong>${dl} days in arrears</strong>. The debt stands at <strong>${t}</strong> and accrues interest daily.</p>
      ${totalBlock}
      <p><strong>6 days</strong> remain before formal proceedings may commence.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_7: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>NOTICE OF IMMINENT PROCEEDINGS — 5 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. <strong>${t}</strong> remains outstanding.</p>
      ${totalBlock}
      <p>The debtor has <strong>5 days</strong> to comply before the creditor may issue proceedings.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_8: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>NOTICE OF IMMINENT PROCEEDINGS — 4 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> — <strong>${dl} days in arrears</strong>. Outstanding sum: <strong>${t}</strong>.</p>
      ${totalBlock}
      <p><strong>4 days</strong> remain. Immediate payment is demanded.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_9: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>NOTICE OF IMMINENT PROCEEDINGS — 3 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. <strong>${t}</strong> is owed.</p>
      ${totalBlock}
      <p>The debtor has <strong>3 days</strong> to comply. Failure to pay may result in the creditor issuing County Court proceedings and seeking all associated costs.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_10: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>NOTICE OF IMMINENT PROCEEDINGS — 2 DAYS REMAINING</strong></p>
      <p>Invoice <strong>${ref}</strong> — <strong>${dl} days in arrears</strong>. <strong>${t}</strong> remains unpaid.</p>
      ${totalBlock}
      <p><strong>2 days</strong> remain before the creditor may file proceedings. This is one of the debtor's final opportunities to avoid a County Court Judgement.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_11: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>FINAL NOTICE — PROCEEDINGS MAY BE ISSUED TOMORROW</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. <strong>${t}</strong> is owed.</p>
      ${totalBlock}
      <p><strong>Tomorrow, the creditor may refer this matter for formal recovery.</strong> This is the debtor's final opportunity to settle without the issuance of County Court proceedings, which will result in a CCJ and liability for all court fees and costs.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
    recovery_final: `
      <p>Dear ${invoice.client_name},</p>
      <p><strong>NOTICE OF REFERRAL FOR FORMAL RECOVERY</strong></p>
      <p>Invoice <strong>${ref}</strong> is <strong>${dl} days in arrears</strong>. Despite 45 days of written demands and multiple opportunities to settle, the sum of <strong>${t}</strong> has not been received.</p>
      ${totalBlock}
      <p>The recovery period has now concluded. The creditor may now pursue this debt through formal channels, which may include:</p>
      <ul style="margin:12px 0;padding-left:20px;color:#0f172a;">
        <li>Issuance of proceedings in the County Court</li>
        <li>Entry of a County Court Judgement (CCJ) on the debtor's credit record</li>
        <li>Referral to certificated enforcement agents (bailiffs)</li>
        <li>Continued accrual of statutory interest until the debt is discharged in full</li>
      </ul>
      <p>If the debtor wishes to avoid formal proceedings, payment of <strong>${t}</strong> must be made immediately.</p>
      ${payBlock}
      <p>Yours faithfully,<br/>${fromName}</p>
    `,
  }
  return bodies[stage]
}
