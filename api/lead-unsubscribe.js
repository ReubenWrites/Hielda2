// Vercel Serverless Function: one-click unsubscribe for lead drip emails.
// Linked from every lead email footer and from the List-Unsubscribe
// header (which sends a POST for Gmail/Outlook one-click unsubscribe).

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function page(title, message) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="robots" content="noindex"/>
  <title>${title} — Hielda</title>
</head>
<body style="margin:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:80px auto;padding:0 20px;">
    <div style="background:#fff;border:1px solid #dce1e8;border-radius:12px;padding:40px 32px;text-align:center;">
      <div style="font-weight:700;font-size:18px;color:#0f172a;margin-bottom:10px;">${title}</div>
      <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0;">${message}</p>
      <a href="https://hielda.com" style="display:inline-block;margin-top:24px;font-size:13px;color:#1e5fa0;font-weight:600;text-decoration:none;">hielda.com</a>
    </div>
  </div>
</body>
</html>`
}

export default async function handler(req, res) {
  // GET = footer link click; POST = RFC 8058 one-click from the mail client.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const email = String(req.query.email || '').trim().toLowerCase()
  const token = String(req.query.token || '').trim()

  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  if (!email || !token) {
    return res.status(400).send(page('Link not valid', 'This unsubscribe link is missing some information. Please use the link from the bottom of the email.'))
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Token must match — prevents third parties unsubscribing someone by
  // guessing their email address.
  const { data: lead } = await supabase
    .from('calculator_leads')
    .select('id, unsubscribe_token, unsubscribed')
    .eq('email', email)
    .maybeSingle()

  if (!lead || !lead.unsubscribe_token || lead.unsubscribe_token !== token) {
    return res.status(400).send(page('Link not valid', 'This unsubscribe link doesn\'t match our records. Please use the link from the bottom of the most recent email.'))
  }

  if (!lead.unsubscribed) {
    await supabase
      .from('calculator_leads')
      .update({ unsubscribed: true })
      .eq('id', lead.id)
  }

  return res.status(200).send(page("You're unsubscribed", 'You won\'t receive any more emails from this series. The free calculator, letter generator and guides remain free to use any time.'))
}
