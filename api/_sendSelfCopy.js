// Send a copy of an invoice to the freelancer themselves. Used by the
// "Email me a copy" button on the invoice Detail page — useful for
// forwarding to an accountant, keeping a copy outside the client thread.
//
// Not a standalone endpoint: the Hobby plan caps deployments at 12
// serverless functions, so this is dispatched from send-chase-email.js
// when the request body carries self_copy: true.

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
function esc(s) {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function sendSelfCopy(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { invoice_id, user_token } = req.body
    if (!invoice_id) return res.status(400).json({ error: 'invoice_id required' })
    if (!user_token) return res.status(401).json({ error: 'Authentication required' })
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Server not configured — missing API keys' })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(user_token)
    if (authErr || !user) return res.status(401).json({ error: 'Invalid or expired token' })

    const [{ data: invoice, error: invErr }, { data: profile }] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', invoice_id).eq('user_id', user.id).single(),
      supabase.from('profiles').select('full_name,business_name,email,sort_code,account_number,account_name,bank_name').eq('id', user.id).single(),
    ])

    if (invErr || !invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (!profile?.email) return res.status(400).json({ error: 'Your profile is missing an email address.' })

    const senderName = profile.business_name || profile.full_name || 'You'

    const lineItemRows = (invoice.line_items?.length) ? invoice.line_items.map(li =>
      `<tr style="border-bottom:1px solid #e8ecf0;">
        <td style="padding:8px 0;color:#374151;font-size:13px;">${esc(li.description)}</td>
        <td style="padding:8px 0;font-size:13px;text-align:right;font-weight:500;font-family:monospace;">${fmt(li.amount)}</td>
      </tr>`
    ).join('') : ''

    const sentTo = esc(invoice.client_email || '—')
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:#1e5fa0;padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda — Your copy</div>
      </div>
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
        <p>Here's a copy of invoice <strong>${esc(invoice.ref)}</strong> issued to <strong>${esc(invoice.client_name)}</strong> at <strong>${sentTo}</strong>.</p>
        <div style="background:#f8fafc;border:1px solid #dce1e8;border-radius:10px;padding:20px 24px;margin:24px 0;">
          <div style="font-weight:700;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px;">Invoice details</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="border-bottom:1px solid #e8ecf0;"><td style="padding:8px 0;color:#64748b;">Reference</td><td style="padding:8px 0;font-weight:600;text-align:right;">${esc(invoice.ref)}</td></tr>
            ${invoice.client_ref ? `<tr style="border-bottom:1px solid #e8ecf0;"><td style="padding:8px 0;color:#64748b;">Client ref</td><td style="padding:8px 0;text-align:right;">${esc(invoice.client_ref)}</td></tr>` : ''}
            ${lineItemRows ? `<tr><td colspan="2" style="padding:8px 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Line items</td></tr>${lineItemRows}` : ''}
            <tr style="border-bottom:1px solid #e8ecf0;"><td style="padding:8px 0;color:#64748b;">Issue date</td><td style="padding:8px 0;text-align:right;">${formatDate(invoice.issue_date)}</td></tr>
            <tr style="border-bottom:1px solid #e8ecf0;"><td style="padding:8px 0;color:#64748b;">Due date</td><td style="padding:8px 0;text-align:right;">${formatDate(invoice.due_date)}</td></tr>
            ${invoice.notes ? `<tr style="border-bottom:1px solid #e8ecf0;"><td colspan="2" style="padding:8px 0;color:#64748b;"><strong style="color:#0f172a;">Notes:</strong> ${esc(invoice.notes)}</td></tr>` : ''}
            <tr><td style="padding:10px 0 4px;font-weight:700;">Total</td><td style="padding:10px 0 4px;font-weight:700;font-size:18px;text-align:right;color:#1e5fa0;">${fmt(invoice.total_with_vat || invoice.amount)}</td></tr>
          </table>
        </div>
        <p style="color:#64748b;font-size:12px;">This is a private copy. Your client has not been re-emailed.</p>
      </div>
    </div>
  </div>
</body></html>`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Hielda <notifications@hielda.com>`,
        reply_to: profile.email,
        to: [profile.email],
        subject: `Your copy: Invoice ${invoice.ref} for ${invoice.client_name}`,
        html,
      }),
    })

    const resendData = await resendRes.json()
    if (!resendRes.ok) return res.status(500).json({ error: resendData.message || 'Email send failed' })

    return res.status(200).json({ success: true, sent_to: profile.email })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
