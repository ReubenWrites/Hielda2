// Vercel Serverless Function: Send dispute acknowledgement OR resolution email to client
// action = 'acknowledge' (default): confirms chasing is paused while dispute is reviewed
// action = 'resolve': notifies client that dispute has been resolved with outcome

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

function buildAckEmail(invoice, fromName, amount) {
  return {
    subject: `Dispute Acknowledged — Invoice ${invoice.ref}`,
    html: `<!DOCTYPE html>
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
</html>`,
  }
}

function buildResolveEmail(invoice, fromName, amount, outcome) {
  const outcomeText = {
    paid: 'The invoice has been marked as <strong>paid in full</strong>. No further action is required.',
    adjusted: 'The invoice amount has been <strong>adjusted</strong> and a revised payment schedule will follow. Chasing will resume from the beginning.',
    written_off: 'The invoice has been <strong>written off</strong>. No further payment is expected and no further correspondence will be sent regarding this invoice.',
  }

  const outcomeLabel = {
    paid: 'Resolved — Paid in Full',
    adjusted: 'Resolved — Amount Adjusted',
    written_off: 'Resolved — Written Off',
  }

  return {
    subject: `Dispute Resolved — Invoice ${invoice.ref}`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:#16a34a;padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
      </div>
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
        <p>Dear ${invoice.client_name},</p>
        <p>We are writing to let you know that the dispute regarding invoice <strong>${invoice.ref}</strong> for <strong>${amount}</strong> has been resolved.</p>
        <div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:13px;color:#14532d;">
          <strong>Outcome:</strong> ${outcomeLabel[outcome] || outcome}<br/>
          ${outcomeText[outcome] || 'Please contact us if you have any questions.'}
        </div>
        <p>Thank you for your patience while this matter was reviewed. If you have any questions, please reply to this email.</p>
        <p>Regards,<br/>${fromName}</p>
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
      Sent via <a href="https://hielda.com" style="color:#1e5fa0;text-decoration:none;font-weight:600;">Hielda</a> — Late payment enforcement for freelancers & SMEs.
    </div>
  </div>
</body>
</html>`,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { invoice_id, user_token, action = 'acknowledge', outcome } = req.body
  if (!invoice_id || !user_token) {
    return res.status(400).json({ error: 'Missing invoice_id or user_token' })
  }

  if (action === 'resolve' && !outcome) {
    return res.status(400).json({ error: 'Missing outcome for resolve action' })
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
  const amount = fmt(invoice.amount)

  const email = action === 'resolve'
    ? buildResolveEmail(invoice, fromName, amount, outcome)
    : buildAckEmail(invoice, fromName, amount)

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
        subject: email.subject,
        html: email.html,
      }),
    })

    return res.status(200).json({ sent: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
