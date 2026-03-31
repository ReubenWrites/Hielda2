// Vercel Serverless Function: Admin referrals management
// GET (POST) - list all referrals and payouts
// PUT - update a payout status

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ADMIN_EMAIL) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const { user_token } = req.body
  if (!user_token) {
    return res.status(400).json({ error: 'Missing token' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify admin
  const { data: { user }, error: authErr } = await supabase.auth.getUser(user_token)
  if (authErr || !user || user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method === 'PUT') {
    // Update payout status
    const { payout_id, status } = req.body
    if (!payout_id || !status) {
      return res.status(400).json({ error: 'Missing payout_id or status' })
    }

    const updateData = { status }
    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString()
    }

    const { error: updateErr } = await supabase
      .from('referral_payouts')
      .update(updateData)
      .eq('id', payout_id)

    if (updateErr) {
      return res.status(500).json({ error: updateErr.message })
    }

    // If payout is marked as paid, update the referral status too
    if (status === 'paid') {
      const { data: payout } = await supabase
        .from('referral_payouts')
        .select('referral_id')
        .eq('id', payout_id)
        .single()

      if (payout?.referral_id) {
        await supabase
          .from('referrals')
          .update({ status: 'paid_out', updated_at: new Date().toISOString() })
          .eq('id', payout.referral_id)
      }
    }

    return res.json({ ok: true })
  }

  // Default: list all referrals and payouts
  const [{ data: referrals }, { data: payouts }] = await Promise.all([
    supabase
      .from('referrals')
      .select('*, referrer:referrer_id(email)')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('referral_payouts')
      .select('*, referrer:referrer_id(email)')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // Flatten referrer email
  const flatRefs = (referrals || []).map(r => ({
    ...r,
    referrer_email: r.referrer?.email,
    referrer: undefined,
  }))
  const flatPays = (payouts || []).map(p => ({
    ...p,
    referrer_email: p.referrer?.email,
    referrer: undefined,
  }))

  return res.json({ referrals: flatRefs, payouts: flatPays })
}
