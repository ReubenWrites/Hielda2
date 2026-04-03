// Vercel Serverless Function: Send dispute acknowledgement email to client
// Confirms that chasing is paused while the dispute is reviewed.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { invoice_id, user_token } = req.body
  if (!invoice_id || !user_token) {
    return res.status(400).json({ error: 'Missing invoice_id or user_token' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify user
  const { data: { user }, error: authErr } = await supabase.auth.getUser(user_token)
  if (authErr || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Get invoice
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('ref, client_name, client_email, amount, due_date, user_id')
    .eq('id', invoice_id)
    .single()

  if (invErr || !invoice || invoice.user_id !== user.id) {
    return res.status(404).json({ error: 'Invoice not found' })
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, business_name')
    .eq('id', user.id)
    .single()

  const fromName = profile?.business_name || profile?.full_name || 'Hielda User'
  const amount = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(invoice.amount)

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:#7c3aed;padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
      </div>
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
        <p>Dear ${invoice.client_name},</p>
        <p>We are writing to confirm that a dispute has been raised regarding invoice <strong>${invoice.ref}</strong> for <strong>${amount}</strong>.</p>
        <p>All automated chasing and penalty accrual for this invoice has been <strong>paused</strong> while the dispute is reviewed.</p>
        <p>If you have any information or documentation that would help resolve this matter, please reply to this email or contact ${fromName} directly.</p>
        <p>We aim to resolve all disputes promptly and fairly.</p>
        <p>Regards,<br/>${fromName}</p>
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
      Sent via <a href="https://hielda.com" style="color:#1e5fa0;text-decoration:none;font-weight:600;">Hielda</a> — Late payment enforcement for freelancers & SMEs.
    </div>
  </div>
</body>
</html>`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} via Hielda <chase@hielda.com>`,
        reply_to: user.email,
        to: [invoice.client_email],
        cc: [user.email],
        subject: `Dispute Acknowledged — Invoice ${invoice.ref}`,
        html,
      }),
    })

    return res.status(200).json({ sent: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
