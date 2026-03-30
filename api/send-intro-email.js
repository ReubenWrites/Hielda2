// Vercel Serverless Function: Send a client introduction email via Resend

import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { client_name, client_email, intro_text, user_token } = req.body

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

    // Get freelancer profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, business_name, email')
      .eq('id', user.id)
      .single()

    const senderName = profile?.business_name || profile?.full_name || 'Your contact'

    const htmlBody = intro_text
      .split('\n')
      .map(line => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 12px;font-family:sans-serif;font-size:15px;color:#1a1a2e;line-height:1.6">${line}</p>`)
      .join('')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${senderName} via Hielda <hello@hielda.com>`,
        to: [client_email],
        ...(profile?.email ? { cc: [profile.email] } : {}),
        subject: `A quick note from ${senderName}`,
        html: `<div style="max-width:580px;margin:0 auto;padding:32px 24px">${htmlBody}</div>`,
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
