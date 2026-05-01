// Standard intro/invoice email body. Used both by the new-invoice flow
// (Create.jsx) and the resend path on existing invoices (Detail.jsx).
export function buildIntroText(profile, clientName) {
  const sender = profile?.business_name || profile?.full_name || "your contact"
  const client = clientName || "there"
  return `Hi ${client},\n\nJust a quick note to let you know that ${sender} has recently started using Hielda to manage their invoicing and payments professionally. This has nothing to do with you specifically — it's simply good practice for independent professionals to have a dedicated system handling the admin side of things, because cashflow is critically important to individuals and small businesses.\n\nFrom now on, invoice-related communications may come via Hielda. Nothing changes on your side — you'll continue to receive invoices and payment reminders as normal. If you have any questions, please feel free to get in touch directly with ${sender}.\n\nWarm regards,\nThe Hielda team, on behalf of ${sender}`
}
