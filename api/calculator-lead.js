// Vercel Serverless Function: Save calculator lead and send follow-up email
// Called when a visitor submits their email on the late payment calculator
// or the letter template/generator page. The `source` field picks which
// email they get: letter-template leads were promised the actual template,
// calculator leads get their calculation summary.

import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

// Statutory rate: 8% over BoE base. Live-fetched with a static fallback so
// the email never blocks on the BoE endpoint.
async function statutoryRate() {
  try {
    const { fetchBoeRate } = await import('./boe-rate.js')
    const { rate } = await fetchBoeRate()
    return 8 + rate
  } catch {
    return 11.75
  }
}

function emailShell(bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:#1e5fa0;padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
      </div>
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
        ${bodyHtml}
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
      <a href="https://hielda.com" style="color:#1e5fa0;text-decoration:none;font-weight:600;">hielda.com</a>
      · <a href="https://hielda.com/privacy" style="color:#94a3b8;">Privacy Policy</a>
    </div>
  </div>
</body>
</html>`
}

// Shared "useful next steps" block — free resources first, then the trial
// pitch. Leads who got value from a free tool convert better than leads
// who only got a sales email.
function nextStepsHtml() {
  return `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin:20px 0;">
          <div style="font-weight:700;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">Useful next steps</div>
          <p style="margin:0 0 8px;font-size:13px;"><a href="https://hielda.com/late-payment-letter-template" style="color:#1e5fa0;font-weight:600;text-decoration:none;">Generate a formal demand letter</a> — your figures filled in, ready to send</p>
          <p style="margin:0 0 8px;font-size:13px;"><a href="https://hielda.com/guides/client-not-paying-invoice" style="color:#1e5fa0;font-weight:600;text-decoration:none;">Client not paying? The step-by-step playbook</a></p>
          <p style="margin:0;font-size:13px;"><a href="https://hielda.com/guides/letter-before-action" style="color:#1e5fa0;font-weight:600;text-decoration:none;">When and how to send a Letter Before Action</a></p>
        </div>`
}

function trialCtaHtml() {
  return `
        <p>Hielda automates the entire process: it sends formal chase emails, applies the statutory charges, and escalates through 19 stages — so you never have to ask awkwardly for your own money.</p>

        <div style="text-align:center;margin:28px 0;">
          <a href="https://hielda.com" style="display:inline-block;padding:14px 36px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Start your free 6-week trial</a>
        </div>

        <p style="font-size:13px;color:#64748b;">Your first 6 weeks are completely free. No card required to start — you only pay when you're ready.</p>

        <p>Best,<br/>The Hielda Team</p>`
}

function calculatorEmail({ invoice_amount, days_overdue, total_claimable }) {
  const totalStr = total_claimable ? fmt(total_claimable) : null
  const daysStr = days_overdue ? `${days_overdue} days` : null

  const body = `
        <p>Hi there,</p>
        <p>Here's a summary of your late payment calculation:</p>

        <div style="background:#f1f3f6;border-radius:10px;padding:20px 24px;margin:20px 0;">
          <div style="font-weight:700;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px;">Your Calculation</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            ${invoice_amount ? `<tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0;color:#64748b;">Invoice amount</td>
              <td style="padding:8px 0;font-weight:600;text-align:right;">${fmt(invoice_amount)}</td>
            </tr>` : ''}
            ${daysStr ? `<tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0;color:#64748b;">Days overdue</td>
              <td style="padding:8px 0;font-weight:600;text-align:right;">${daysStr}</td>
            </tr>` : ''}
            ${totalStr ? `<tr>
              <td style="padding:10px 0 4px;font-weight:700;color:#0f172a;">Total you can claim</td>
              <td style="padding:10px 0 4px;font-weight:700;font-size:18px;text-align:right;color:#1e5fa0;">${totalStr}</td>
            </tr>` : ''}
          </table>
        </div>

        <p>Under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>, you're legally entitled to claim this amount from your client — including the fixed debt recovery cost and daily interest. You don't need a solicitor, and you don't need to have mentioned it on your original invoice.</p>
        ${nextStepsHtml()}
        ${trialCtaHtml()}`

  return {
    subject: totalStr
      ? `Your late payment calculation: ${totalStr} claimable`
      : 'Your late payment calculation from Hielda',
    html: emailShell(body),
  }
}

function letterTemplateEmail({ invoice_amount, days_overdue, total_claimable, rate }) {
  const hasFigures = invoice_amount > 0
  const amountStr = hasFigures ? fmt(invoice_amount) : '[£Amount]'
  const totalStr = total_claimable > 0 ? fmt(total_claimable) : '[£Total Including Interest]'

  const body = `
        <p>Hi there,</p>
        <p>Here's the late payment demand letter template you asked for. Copy it into an email or letterhead, fill in anything in [brackets], and send it to your client.</p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin:20px 0;font-size:13px;line-height:1.8;">
          <p style="color:#94a3b8;margin:0 0 14px;">[Your Business Name]<br/>[Your Address]<br/>[Date]</p>
          <p style="margin:0 0 12px;">Dear [Client Name],</p>
          <p style="margin:0 0 12px;"><strong>RE: Overdue Invoice [Invoice Ref] — Formal Notice</strong></p>
          <p style="margin:0 0 12px;">I am writing to notify you that invoice [Invoice Ref] for the sum of ${amountStr} is now overdue. Payment was due on [Due Date].</p>
          <p style="margin:0 0 12px;">Under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>, I am legally entitled to charge statutory interest at <strong>${rate}% per annum</strong> (8% above the Bank of England base rate) on the outstanding amount, accruing daily from the day after the due date, plus a fixed sum for debt recovery costs (£40 / £70 / £100 depending on invoice value).</p>
          <p style="margin:0 0 12px;">I would be grateful if you could arrange payment of the full amount of ${totalStr} within <strong>7 days</strong> of the date of this letter. Payment should be made to:</p>
          <p style="margin:0 0 12px;color:#94a3b8;">Account Name: [Your Account Name]<br/>Sort Code: [XX-XX-XX]<br/>Account Number: [XXXXXXXX]<br/>Reference: [Invoice Ref]</p>
          <p style="margin:0 0 12px;">If payment is not received within this period, I reserve the right to pursue this debt through formal channels, which may include referral to a debt recovery agency or County Court proceedings. Such proceedings may adversely affect your credit rating.</p>
          <p style="margin:0 0 12px;">I trust this matter can be resolved promptly. If you have already made payment, please disregard this notice and accept my thanks.</p>
          <p style="margin:0;">Yours faithfully,<br/>[Your Name]<br/>[Your Business Name]</p>
        </div>

        <p style="font-size:13px;">Tip: the <a href="https://hielda.com/late-payment-letter-template" style="color:#1e5fa0;font-weight:600;">letter generator</a> fills in your figures and calculates the exact interest owed${hasFigures && days_overdue ? ` (you were at ${days_overdue} days overdue when you used it — the total has grown since)` : ''}.</p>
        ${nextStepsHtml()}
        ${trialCtaHtml()}`

  return {
    subject: 'Your late payment letter template',
    html: emailShell(body),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  // The letter template page historically posted `amount`; the calculator
  // posts `invoice_amount`. Accept both.
  const { email, invoice_amount, amount, days_overdue, total_claimable, source } = req.body
  const amt = Number(invoice_amount || amount) || null

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Save the lead (upsert to avoid duplicates on same email)
  await supabase.from('calculator_leads').upsert(
    {
      email: email.trim().toLowerCase(),
      invoice_amount: amt,
      days_overdue: days_overdue || null,
      total_claimable: total_claimable || null,
    },
    { onConflict: 'email', ignoreDuplicates: false }
  )

  // Send follow-up email if Resend is configured
  if (RESEND_API_KEY) {
    const payload = { invoice_amount: amt, days_overdue, total_claimable }
    const { subject, html } =
      source === 'letter_template'
        ? letterTemplateEmail({ ...payload, rate: await statutoryRate() })
        : calculatorEmail(payload)

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hielda <hello@hielda.com>',
        to: [email.trim()],
        subject,
        html,
      }),
    })
    // Fire and forget — don't fail the response if email sending fails
  }

  return res.status(200).json({ success: true })
}
