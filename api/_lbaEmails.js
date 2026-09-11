// The day-30 Letter Before Action prompt, sent to the USER (not the client).
//
// Day 30 is where chasing stops being chasing and becomes the start of a
// legal process. Most freelancers don't know that, don't know a Letter
// Before Action exists, and assume "legal action" means hiring a solicitor.
// This email exists to say, briefly: you can act now, here is the first
// step, it commits you to nothing, and we'll write it for you.
//
// Underscore-prefixed: a module, not a Vercel function (Hobby caps us at 12
// and we are at the cap).

function esc(text) {
  if (!text) return ''
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

// 14 days company-to-company; 30 where the debtor is a sole trader, because
// the Pre-Action Protocol for Debt Claims treats them as an individual.
export function lbaResponseDays(invoice) {
  return invoice?.client_entity === 'sole_trader' ? 30 : 14
}

const BTN = 'display:inline-block;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;'

/**
 * @param invoice  the overdue invoice
 * @param profile  the user's profile (for the greeting + recipient)
 * @param dfd      days past due
 * @param owed     total now owed including charges, if known
 */
export function buildLbaPromptEmail(invoice, profile, dfd, owed) {
  const name = esc(profile.full_name || profile.business_name || 'there')
  const client = esc(invoice.client_name || 'your client')
  const ref = esc(invoice.ref)
  const days = lbaResponseDays(invoice)
  const draftUrl = `https://www.hielda.com/invoice/${invoice.id}/letter-before-action`
  const invoiceUrl = `https://www.hielda.com/invoice/${invoice.id}`
  const amountLine = owed > 0
    ? `<tr><td style="padding:3px 0;color:#64748b;">Now owed</td><td style="padding:3px 0;font-weight:700;text-align:right;font-family:monospace;">${fmt(owed)}</td></tr>`
    : ''

  const subject = `${ref} is ${dfd} days overdue — you can now take the first legal step`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:#18181b;padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
      </div>
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
        <p style="margin:0 0 16px;">Hi ${name},</p>

        <p style="margin:0 0 16px;"><strong>${ref}</strong> is now more than 30 days overdue, and ${client} still hasn't paid. At this point you're entitled to begin taking legal action to recover the debt.</p>

        <div style="background:#f1f3f6;padding:16px 18px;border-radius:8px;margin:0 0 20px;font-size:13px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:3px 0;color:#64748b;">Invoice</td><td style="padding:3px 0;font-weight:600;text-align:right;">${ref}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Client</td><td style="padding:3px 0;text-align:right;">${client}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Overdue by</td><td style="padding:3px 0;text-align:right;">${dfd} days</td></tr>
            ${amountLine}
          </table>
        </div>

        <p style="margin:0 0 16px;">The first step is a <strong>Letter Before Action</strong>. It's a formal notice telling ${client} exactly what they owe and giving them <strong>${days} more days</strong> to pay before you take it further.</p>

        <p style="margin:0 0 16px;">Sending it doesn't commit you to anything. You can stop at any point. But if you do decide to make a claim later, the court will expect you to have sent one first, so it's worth doing either way.</p>

        <p style="margin:0 0 8px;">We'll draft it for you from this invoice — the figures, the dates and the legal wording are all filled in. You just read it and decide.</p>

        <div style="margin:24px 0;text-align:center;">
          <a href="${draftUrl}" style="${BTN}background:#18181b;color:#fff;">Draft my Letter Before Action</a>
        </div>

        <p style="margin:0 0 16px;font-size:13px;color:#64748b;">No rush — the option stays on the invoice, so you can do this whenever you're ready. In the meantime Hielda keeps chasing and the statutory interest keeps adding up.</p>

        <div style="text-align:center;margin:0 0 8px;">
          <a href="${invoiceUrl}" style="color:#1e5fa0;font-size:13px;text-decoration:none;">View ${ref}</a>
        </div>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #eef1f5;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;">
        Hielda chases late invoices and claims the statutory interest and fees you're owed under UK law.<br/>
        This is general information about the process, not legal advice.
      </div>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}
