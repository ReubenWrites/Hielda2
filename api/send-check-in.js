// Vercel Serverless Function: Send a check-in email TO THE FREELANCER
// Before sending a chase to the client, we ask "Has your client paid yet?"

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const STAGE_LABELS = {
  reminder_1: 'Friendly Reminder',
  reminder_2: 'Second Reminder',
  first_chase: 'First Chase',
  second_chase: 'Second Chase + Interest',
  final_notice: 'Final Notice',
}

const STAGE_COLORS = {
  reminder_1: '#1e5fa0', reminder_2: '#2d72b8', first_chase: '#d97706',
  second_chase: '#c2410c', final_notice: '#9f1239',
}

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function signToken(data, secret) {
  const payload = JSON.stringify({ ...data, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

function buildCheckInEmail(invoice, profile, stage, token) {
  const color = STAGE_COLORS[stage] || '#1e5fa0'
  const stageLabel = STAGE_LABELS[stage] || stage
  const fromName = profile.business_name || profile.full_name || 'Hielda User'
  const baseUrl = 'https://www.hielda.com/api/check-in-response'

  const paidUrl = `${baseUrl}?action=paid&invoice_id=${invoice.id}&token=${encodeURIComponent(token)}`
  const chaseUrl = `${baseUrl}?action=chase&invoice_id=${invoice.id}&stage=${stage}&token=${encodeURIComponent(token)}`
  const editUrl = `https://www.hielda.com/?invoice=${invoice.id}&edit_chase=true`
  const skipUrl = `${baseUrl}?action=skip&invoice_id=${invoice.id}&token=${encodeURIComponent(token)}`

  const subject = `Check-in: Has ${invoice.client_name} paid invoice ${invoice.ref}?`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:${color};padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
      </div>
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
        <p>Hi ${fromName},</p>
        <p>Before we send a <strong>${stageLabel}</strong> to <strong>${invoice.client_name}</strong>, we wanted to check in with you first.</p>

        <div style="background:#f1f3f6;padding:16px 18px;border-radius:8px;margin:20px 0;font-size:13px;">
          <div style="font-weight:600;color:#0f172a;margin-bottom:8px;">Invoice Details</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:3px 0;color:#64748b;">Reference</td><td style="padding:3px 0;font-weight:500;text-align:right;">${invoice.ref}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Client</td><td style="padding:3px 0;font-weight:500;text-align:right;">${invoice.client_name}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Amount</td><td style="padding:3px 0;font-weight:500;text-align:right;">${fmt(invoice.amount)}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Due Date</td><td style="padding:3px 0;font-weight:500;text-align:right;">${formatDate(invoice.due_date)}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Pending Stage</td><td style="padding:3px 0;font-weight:600;color:${color};text-align:right;">${stageLabel}</td></tr>
          </table>
        </div>

        <p style="font-weight:600;margin-bottom:20px;">Has ${invoice.client_name} paid this invoice?</p>

        <div style="text-align:center;margin:24px 0 16px;">
          <a href="${paidUrl}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:0 8px 12px;">Yes, they've paid</a>
          <a href="${chaseUrl}" style="display:inline-block;padding:14px 32px;background:${color};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:0 8px 12px;">No, chase for me</a>
        </div>

        <div style="border-top:1px solid #e2e8f0;margin:8px 0 0;padding:16px 0 0;text-align:center;">
          <a href="${editUrl}" style="display:inline-block;padding:10px 20px;background:#fff;color:${color};text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;border:1px solid ${color};margin:0 6px 8px;">Let me edit the chase email</a>
          <a href="${skipUrl}" style="display:inline-block;padding:10px 20px;background:#fff;color:#64748b;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;border:1px solid #cbd5e1;margin:0 6px 8px;">Don't chase this one</a>
        </div>

        <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:16px;">We won't send anything to your client until you give the go-ahead.</p>
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
      Sent via Hielda — Protecting your pay.
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { invoice_id, chase_stage, user_token } = req.body

    if (!invoice_id || !chase_stage) {
      return res.status(400).json({ error: 'invoice_id and chase_stage required' })
    }

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Server not configured — missing API keys' })
    }

    // ── Authentication: verify user token ──
    if (!user_token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const supabaseAuth = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${user_token}` } },
    })

    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Service role client for DB operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single()

    if (invErr || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    // ── Authorization: check invoice ownership ──
    if (invoice.user_id !== user.id) {
      return res.status(403).json({ error: 'You do not own this invoice' })
    }

    // Fetch profile
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', invoice.user_id)
      .single()

    if (profErr || !profile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    // Check if a check-in was already sent for this stage
    const { data: existingCheckIn } = await supabase
      .from('chase_log')
      .select('id')
      .eq('invoice_id', invoice_id)
      .eq('chase_stage', chase_stage)
      .eq('status', 'check_in_sent')
      .limit(1)

    if (existingCheckIn && existingCheckIn.length > 0) {
      return res.status(409).json({ error: 'Check-in already sent for this stage' })
    }

    // Generate signed action token
    const token = signToken({
      invoice_id,
      chase_stage,
      user_id: user.id,
    }, SUPABASE_SERVICE_KEY)

    // Build check-in email
    const email = buildCheckInEmail(invoice, profile, chase_stage, token)

    // Send via Resend — TO THE FREELANCER (user), not the client
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hielda <notifications@hielda.com>',
        to: [user.email],
        subject: email.subject,
        html: email.html,
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      return res.status(500).json({ error: resendData.message || 'Email send failed' })
    }

    // Log the check-in send
    await supabase.from('chase_log').insert({
      invoice_id,
      user_id: invoice.user_id,
      chase_stage,
      email_to: user.email,
      status: 'check_in_sent',
    })

    return res.status(200).json({
      success: true,
      resend_id: resendData.id,
      email_to: user.email,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
