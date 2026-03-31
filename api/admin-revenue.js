// Vercel Serverless Function: Admin revenue dashboard
// Fetches subscription and payment data from Supabase + Stripe

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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

  // Get subscription breakdown from Supabase
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('status, plan')

  const breakdown = {}
  let activeSubs = 0
  let trialing = 0
  let churned = 0

  for (const sub of (subs || [])) {
    breakdown[sub.status] = (breakdown[sub.status] || 0) + 1
    if (sub.status === 'active') activeSubs++
    if (sub.status === 'trialing') trialing++
    if (sub.status === 'canceled') churned++
  }

  const result = {
    active_subscriptions: activeSubs,
    trialing,
    churned,
    breakdown: Object.entries(breakdown).map(([status, count]) => ({ status, count })),
    mrr: 0,
    recent_payments: [],
  }

  // Try to get Stripe data if configured
  if (STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(STRIPE_SECRET_KEY)

      // Get recent invoices for payment list
      const invoices = await stripe.invoices.list({ limit: 20, status: 'paid' })
      result.recent_payments = invoices.data.map(inv => ({
        customer: inv.customer,
        email: inv.customer_email,
        amount: inv.amount_paid,
        status: inv.status,
        created: inv.created,
      }))

      // Calculate MRR from active subscriptions
      const stripeSubs = await stripe.subscriptions.list({ status: 'active', limit: 100 })
      result.mrr = stripeSubs.data.reduce((sum, sub) => {
        const item = sub.items.data[0]
        if (!item) return sum
        const amount = item.price.unit_amount || 0
        const interval = item.price.recurring?.interval
        if (interval === 'month') return sum + amount / 100
        if (interval === 'year') return sum + amount / 100 / 12
        return sum
      }, 0)
      result.mrr = Math.round(result.mrr * 100) / 100
    } catch (e) {
      // Stripe data is optional — return what we have
      console.error('Stripe error:', e.message)
    }
  }

  return res.json(result)
}
