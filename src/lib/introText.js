// Standard intro/invoice email body. Used both by the new-invoice flow
// (Create.jsx) and the resend path on existing invoices (Detail.jsx).
//
// requestedDays: when the user wanted terms shorter than the enforceable
// 30-day default but the client hasn't agreed them, the early date is a
// polite request here rather than a deadline — asking costs nothing and
// often works, without over-claiming what the law allows.
export function buildIntroText(profile, clientName, requestedDays) {
  const sender = profile?.business_name || profile?.full_name || "your contact"
  const client = clientName || "there"
  const earlyAsk = requestedDays
    ? `\n\nOne small ask: if it's convenient, ${sender} would really appreciate payment within ${requestedDays} days — prompt payment makes a big difference to independent professionals. The formal due date is on the invoice.`
    : ""
  return `Hi ${client},\n\nJust a quick note to let you know that ${sender} has recently started using Hielda to manage their invoicing and payments professionally. This has nothing to do with you specifically — it's simply good practice for independent professionals to have a dedicated system handling the admin side of things, because cashflow is critically important to individuals and small businesses.\n\nFrom now on, invoice-related communications may come via Hielda. Nothing changes on your side — you'll continue to receive invoices and payment reminders as normal.${earlyAsk}\n\nIf you have any questions, please feel free to get in touch directly with ${sender}.\n\nWarm regards,\nThe Hielda team, on behalf of ${sender}`
}
