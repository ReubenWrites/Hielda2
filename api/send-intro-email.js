// Vercel Serverless Function: Send a client introduction email via Resend

import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { client_name, client_email, intro_text, invoice_id, user_token } = req.body

    if (!client_name || !client_email || !intro_text || !user_token) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Server not configured' })
    }

    // Verify user token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(user_token)
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorised' })
    }

    // Get freelancer profile (including payment details)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, business_name, email, sort_code, account_number, account_name, bank_name')
      .eq('id', user.id)
      .single()

    const senderName = profile?.business_name || profile?.full_name || 'Your contact'

    // Fetch invoice if provided
    let invoice = null
    if (invoice_id) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoice_id)
        .eq('user_id', user.id)
        .single()
      invoice = inv
    }

    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    const htmlBody = intro_text
      .split('\n')
      .map(line => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 12px;font-family:sans-serif;font-size:15px;color:#1a1a2e;line-height:1.6">${escapeHtml(line)}</p>`)
      .join('')

    const lineItemRows = (invoice?.line_items?.length) ? invoice.line_items.map(li =>
      `<tr style="border-bottom:1px solid #e8ecf0;">
        <td style="padding:8px 0;color:#64748b;font-size:13px;">${escapeHtml(li.description)}</td>
        <td style="padding:8px 0;font-size:13px;text-align:right;font-weight:500;font-family:monospace;color:#0f172a;">${fmt(li.amount)}</td>
      </tr>`
    ).join('') : ''

    const invoiceBlock = invoice ? `
      <div style="background:#f8fafc;border:1px solid #dce1e8;border-radius:10px;padding:20px 24px;margin:24px 0;">
        <div style="font-weight:700;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px;">Invoice Details</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="border-bottom:1px solid #e8ecf0;">
            <td style="padding:8px 0;color:#64748b;">Reference</td>
            <td style="padding:8px 0;font-weight:600;text-align:right;color:#0f172a;">${invoice.ref}</td>
          </tr>
          ${invoice.client_ref ? `<tr style="border-bottom:1px solid #e8ecf0;">
            <td style="padding:8px 0;color:#64748b;">Your ref</td>
            <td style="padding:8px 0;font-weight:500;text-align:right;color:#0f172a;">${escapeHtml(invoice.client_ref)}</td>
          </tr>` : ''}
          ${lineItemRows ? `
          <tr><td colspan="2" style="padding:8px 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Line Items</td></tr>
          ${lineItemRows}
          <tr style="border-bottom:1px solid #e8ecf0;">
            <td style="padding:6px 0;color:#64748b;font-size:12px;">Subtotal</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;font-family:monospace;font-size:13px;color:#0f172a;">${fmt(invoice.amount)}</td>
          </tr>` : (invoice.description ? `<tr style="border-bottom:1px solid #e8ecf0;">
            <td style="padding:8px 0;color:#64748b;">Description</td>
            <td style="padding:8px 0;font-weight:500;text-align:right;color:#0f172a;">${escapeHtml(invoice.description)}</td>
          </tr>` : '')}
          <tr style="border-bottom:1px solid #e8ecf0;">
            <td style="padding:8px 0;color:#64748b;">Issue Date</td>
            <td style="padding:8px 0;font-weight:500;text-align:right;color:#0f172a;">${formatDate(invoice.issue_date)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e8ecf0;">
            <td style="padding:8px 0;color:#64748b;">Due Date</td>
            <td style="padding:8px 0;font-weight:600;text-align:right;color:#0f172a;">${formatDate(invoice.due_date)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e8ecf0;">
            <td colspan="2" style="padding:10px 0;font-size:12px;color:#1e3a5f;background:#f0f7ff;padding:10px 12px;border-radius:6px;margin:8px 0;display:block;">
              <strong>${formatDate(invoice.due_date)}</strong> is the final date this invoice can be settled at the original amount. After this date, statutory fines and interest will apply. Early payment is always appreciated.
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0 4px;font-weight:700;color:#0f172a;">Total Due</td>
            <td style="padding:10px 0 4px;font-weight:700;font-size:18px;text-align:right;color:#1e5fa0;">${fmt(invoice.amount)}</td>
          </tr>
        </table>
      </div>
      ${(profile?.sort_code || profile?.account_number) ? `
      <div style="background:#f1f3f6;border-radius:8px;padding:16px 20px;margin:16px 0;font-size:13px;">
        <div style="font-weight:600;color:#0f172a;margin-bottom:8px;">Payment Details</div>
        <div style="color:#64748b;line-height:1.8;">
          ${profile.account_name ? `Account Name: ${escapeHtml(profile.account_name)}<br/>` : ''}
          ${profile.bank_name ? `Bank: ${escapeHtml(profile.bank_name)}<br/>` : ''}
          ${profile.sort_code ? `Sort Code: ${escapeHtml(profile.sort_code)}<br/>` : ''}
          ${profile.account_number ? `Account Number: ${escapeHtml(profile.account_number)}<br/>` : ''}
          Reference: ${invoice.ref}${invoice.client_ref ? `<br/>Your ref: ${escapeHtml(invoice.client_ref)}` : ''}
        </div>
      </div>` : ''}
    ` : ''

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
        ${htmlBody}
        ${invoiceBlock}
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
      Sent via <a href="https://hielda.com?ref=chase-email" style="color:#1e5fa0;text-decoration:none;font-weight:600;">Hielda</a> — Late payment enforcement for freelancers &amp; SMEs.
    </div>
  </div>
</body>
</html>`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${senderName} via Hielda <hello@hielda.com>`,
        reply_to: profile?.email || undefined,
        to: [client_email],
        ...(profile?.email ? { cc: [profile.email] } : {}),
        subject: `A quick note from ${senderName}`,
        html,
      }),
    })

    const resendData = await resendRes.json()
    if (!resendRes.ok) {
      return res.status(500).json({ error: resendData.message || 'Email send failed' })
    }

    return res.status(200).json({ success: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
