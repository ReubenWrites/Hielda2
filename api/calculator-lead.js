// Vercel Serverless Function: Save calculator lead and send follow-up email
// Called when a visitor submits their email on the late payment calculator

import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const { email, invoice_amount, days_overdue, total_claimable } = req.body

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Save the lead (upsert to avoid duplicates on same email)
  await supabase.from('calculator_leads').upsert(
    {
      email: email.trim().toLowerCase(),
      invoice_amount: invoice_amount || null,
      days_overdue: days_overdue || null,
      total_claimable: total_claimable || null,
    },
    { onConflict: 'email', ignoreDuplicates: false }
  )

  // Send follow-up email if Resend is configured
  if (RESEND_API_KEY) {
    const amountStr = invoice_amount ? fmt(invoice_amount) : 'your invoice'
    const totalStr = total_claimable ? fmt(total_claimable) : null
    const daysStr = days_overdue ? `${days_overdue} days` : null

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:#1e5fa0;padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
      </div>
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
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

        <p>Under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>, you're legally entitled to claim this amount from your client — including the fixed penalty and daily interest. You don't need a solicitor, and you don't need to have mentioned it on your original invoice.</p>

        <p>Hielda automates the entire process: it sends formal chase emails, applies the statutory charges, and escalates through 19 stages — so you never have to ask awkwardly for your own money.</p>

        <div style="text-align:center;margin:28px 0;">
          <a href="https://hielda.com" style="display:inline-block;padding:14px 36px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Start your free 7-day trial</a>
        </div>

        <p style="font-size:13px;color:#64748b;">Your first 7 days are completely free. No card required to start — you only pay when you're ready.</p>

        <p>Best,<br/>The Hielda Team</p>
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
      <a href="https://hielda.com" style="color:#1e5fa0;text-decoration:none;font-weight:600;">hielda.com</a>
      · <a href="https://hielda.com/privacy" style="color:#94a3b8;">Privacy Policy</a>
    </div>
  </div>
</body>
</html>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hielda <hello@hielda.com>',
        to: [email.trim()],
        subject: totalStr
          ? `Your late payment calculation: ${totalStr} claimable`
          : 'Your late payment calculation from Hielda',
        html,
      }),
    })
    // Fire and forget — don't fail the response if email sending fails
  }

  return res.status(200).json({ success: true })
}
