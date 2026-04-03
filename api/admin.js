// Vercel Serverless Function: Unified admin endpoint
// Routes on req.body.action: "lookup" | "metrics" | "referrals" | "referrals-update" | "revenue"

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const POSTHOG_HOST = process.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com'
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

// ── Shared auth ────────────────────────────────────────────────────────────────

async function verifyAdmin(supabase, token) {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user || user.email !== ADMIN_EMAIL) return null
  return user
}

// ── Lookup ─────────────────────────────────────────────────────────────────────

async function handleLookup(supabase, body, res) {
  const { lookup_email } = body
  if (!lookup_email) return res.status(400).json({ error: 'Missing lookup_email' })

  let targetUser = null
  let page = 1
  const perPage = 100
  while (!targetUser) {
    const { data: { users: batch }, error: batchErr } = await supabase.auth.admin.listUsers({ page, perPage })
    if (batchErr) return res.status(500).json({ error: batchErr.message })
    if (!batch || batch.length === 0) break
    targetUser = batch.find(u => u.email?.toLowerCase() === lookup_email.toLowerCase())
    if (batch.length < perPage) break
    page++
  }

  if (!targetUser) return res.status(404).json({ error: 'No user found with that email address' })

  const [{ data: profile }, { data: subscription }, { data: invoices }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', targetUser.id).single(),
    supabase.from('subscriptions').select('*').eq('user_id', targetUser.id).single(),
    supabase.from('invoices').select('*').eq('user_id', targetUser.id).order('created_at', { ascending: false }),
  ])

  let chaseLogs = []
  if (invoices?.length) {
    const { data: logs } = await supabase
      .from('chase_log').select('*').in('invoice_id', invoices.map(i => i.id)).order('sent_at', { ascending: false })
    chaseLogs = logs || []
  }

  return res.json({
    user: { id: targetUser.id, email: targetUser.email, created_at: targetUser.created_at, last_sign_in_at: targetUser.last_sign_in_at },
    profile: profile || null,
    subscription: subscription || null,
    invoices: invoices || [],
    chase_logs: chaseLogs,
  })
}

// ── Metrics (PostHog) ──────────────────────────────────────────────────────────

async function hogql(query) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${POSTHOG_PERSONAL_API_KEY}` },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.results || null
}

async function handleMetrics(res) {
  if (!POSTHOG_PERSONAL_API_KEY || !POSTHOG_PROJECT_ID) return res.json({ configured: false })

  const [sources, utmSources, utmMediums, utmCampaigns, events, dailyVisitors] = await Promise.all([
    hogql(`SELECT coalesce(nullIf(properties.$referring_domain, ''), '(direct / none)') as source, count() as visits, countIf(event = 'sign_up_completed') as signups FROM events WHERE event IN ('$pageview', 'sign_up_completed') AND timestamp > now() - interval 30 day GROUP BY 1 ORDER BY 2 DESC LIMIT 15`),
    hogql(`SELECT properties.utm_source as utm_source, count() as visits FROM events WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND properties.utm_source IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
    hogql(`SELECT properties.utm_medium as utm_medium, count() as visits FROM events WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND properties.utm_medium IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
    hogql(`SELECT properties.utm_campaign as campaign, count() as visits FROM events WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND properties.utm_campaign IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
    hogql(`SELECT event, count() as count FROM events WHERE event IN ('sign_up_started','sign_up_completed','login','invoice_created','invoice_paid','chase_sent','pdf_downloaded','calculator_used','referral_link_copied','referral_invite_sent') AND timestamp > now() - interval 30 day GROUP BY 1 ORDER BY 2 DESC`),
    hogql(`SELECT toDate(timestamp) as day, count(distinct person_id) as visitors, countIf(event = 'sign_up_completed') as signups FROM events WHERE event IN ('$pageview', 'sign_up_completed') AND timestamp > now() - interval 14 day GROUP BY 1 ORDER BY 1 ASC`),
  ])

  return res.json({
    configured: true, period_days: 30,
    top_sources: (sources || []).map(r => ({ source: r[0], visits: r[1], signups: r[2] })),
    utm_sources: (utmSources || []).map(r => ({ label: r[0], visits: r[1] })),
    utm_mediums: (utmMediums || []).map(r => ({ label: r[0], visits: r[1] })),
    utm_campaigns: (utmCampaigns || []).map(r => ({ label: r[0], visits: r[1] })),
    events: (events || []).map(r => ({ event: r[0], count: r[1] })),
    daily_visitors: (dailyVisitors || []).map(r => ({ day: r[0], visitors: r[1], signups: r[2] })),
  })
}

// ── Referrals ──────────────────────────────────────────────────────────────────

async function handleReferrals(supabase, body, res) {
  const [{ data: referrals }, { data: payouts }] = await Promise.all([
    supabase.from('referrals').select('*, referrer:referrer_id(email)').order('created_at', { ascending: false }).limit(200),
    supabase.from('referral_payouts').select('*, referrer:referrer_id(email)').order('created_at', { ascending: false }).limit(100),
  ])

  const flatRefs = (referrals || []).map(r => ({ ...r, referrer_email: r.referrer?.email, referrer: undefined }))
  const flatPays = (payouts || []).map(p => ({ ...p, referrer_email: p.referrer?.email, referrer: undefined }))
  return res.json({ referrals: flatRefs, payouts: flatPays })
}

async function handleReferralsUpdate(supabase, body, res) {
  const { payout_id, status } = body
  if (!payout_id || !status) return res.status(400).json({ error: 'Missing payout_id or status' })

  const updateData = { status }
  if (status === 'paid') updateData.paid_at = new Date().toISOString()

  const { error: updateErr } = await supabase.from('referral_payouts').update(updateData).eq('id', payout_id)
  if (updateErr) return res.status(500).json({ error: updateErr.message })

  if (status === 'paid') {
    const { data: payout } = await supabase.from('referral_payouts').select('referral_id').eq('id', payout_id).single()
    if (payout?.referral_id) {
      await supabase.from('referrals').update({ status: 'paid_out', updated_at: new Date().toISOString() }).eq('id', payout.referral_id)
    }
  }

  return res.json({ ok: true })
}

// ── Revenue (Stripe) ───────────────────────────────────────────────────────────

async function handleRevenue(supabase, res) {
  const { data: subs } = await supabase.from('subscriptions').select('status, plan')

  const breakdown = {}
  let activeSubs = 0, trialing = 0, churned = 0
  for (const sub of (subs || [])) {
    breakdown[sub.status] = (breakdown[sub.status] || 0) + 1
    if (sub.status === 'active') activeSubs++
    if (sub.status === 'trialing') trialing++
    if (sub.status === 'canceled') churned++
  }

  const result = {
    active_subscriptions: activeSubs, trialing, churned,
    breakdown: Object.entries(breakdown).map(([status, count]) => ({ status, count })),
    mrr: 0, recent_payments: [],
  }

  if (STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(STRIPE_SECRET_KEY)
      const invoices = await stripe.invoices.list({ limit: 20, status: 'paid' })
      result.recent_payments = invoices.data.map(inv => ({
        customer: inv.customer, email: inv.customer_email,
        amount: inv.amount_paid, status: inv.status, created: inv.created,
      }))
      const stripeSubs = await stripe.subscriptions.list({ status: 'active', limit: 100 })
      result.mrr = Math.round(stripeSubs.data.reduce((sum, sub) => {
        const item = sub.items.data[0]
        if (!item) return sum
        const amount = item.price.unit_amount || 0
        const interval = item.price.recurring?.interval
        if (interval === 'month') return sum + amount / 100
        if (interval === 'year') return sum + amount / 100 / 12
        return sum
      }, 0) * 100) / 100
    } catch (e) {
      console.error('Stripe error:', e.message)
    }
  }

  return res.json(result)
}

// ── Router ─────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ADMIN_EMAIL) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const { user_token, action } = req.body
  if (!user_token) return res.status(400).json({ error: 'Missing token' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const admin = await verifyAdmin(supabase, user_token)
  if (!admin) return res.status(403).json({ error: 'Forbidden' })

  switch (action) {
    case 'lookup':           return handleLookup(supabase, req.body, res)
    case 'metrics':          return handleMetrics(res)
    case 'referrals':        return handleReferrals(supabase, req.body, res)
    case 'referrals-update': return handleReferralsUpdate(supabase, req.body, res)
    case 'revenue':          return handleRevenue(supabase, res)
    default:                 return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}
