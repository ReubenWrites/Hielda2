// Vercel Serverless Function: Admin metrics from PostHog
// Queries PostHog's HogQL API for traffic sources, UTM breakdown, and event counts

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const POSTHOG_HOST = process.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com'

async function hogql(query) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.results || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ADMIN_EMAIL) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const { user_token } = req.body
  if (!user_token) return res.status(400).json({ error: 'Missing token' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(user_token)
  if (authErr || !user || user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (!POSTHOG_PERSONAL_API_KEY || !POSTHOG_PROJECT_ID) {
    return res.json({ configured: false })
  }

  const [sources, utmSources, utmMediums, utmCampaigns, events, dailyVisitors] = await Promise.all([
    // Top referring domains (where people came from)
    hogql(`
      SELECT
        coalesce(nullIf(properties.$referring_domain, ''), '(direct / none)') as source,
        count() as visits,
        countIf(event = 'sign_up_completed') as signups
      FROM events
      WHERE event IN ('$pageview', 'sign_up_completed')
        AND timestamp > now() - interval 30 day
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 15
    `),

    // UTM source breakdown
    hogql(`
      SELECT properties.utm_source as utm_source, count() as visits
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval 30 day
        AND properties.utm_source IS NOT NULL
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `),

    // UTM medium breakdown
    hogql(`
      SELECT properties.utm_medium as utm_medium, count() as visits
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval 30 day
        AND properties.utm_medium IS NOT NULL
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `),

    // UTM campaign breakdown
    hogql(`
      SELECT properties.utm_campaign as campaign, count() as visits
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval 30 day
        AND properties.utm_campaign IS NOT NULL
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `),

    // Key product events last 30 days
    hogql(`
      SELECT event, count() as count
      FROM events
      WHERE event IN (
        'sign_up_started', 'sign_up_completed', 'login',
        'invoice_created', 'invoice_paid', 'chase_sent',
        'pdf_downloaded', 'calculator_used',
        'referral_link_copied', 'referral_invite_sent'
      )
        AND timestamp > now() - interval 30 day
      GROUP BY 1
      ORDER BY 2 DESC
    `),

    // Daily unique visitors last 14 days
    hogql(`
      SELECT
        toDate(timestamp) as day,
        count(distinct person_id) as visitors,
        countIf(event = 'sign_up_completed') as signups
      FROM events
      WHERE event IN ('$pageview', 'sign_up_completed')
        AND timestamp > now() - interval 14 day
      GROUP BY 1
      ORDER BY 1 ASC
    `),
  ])

  return res.json({
    configured: true,
    period_days: 30,
    top_sources: (sources || []).map(r => ({
      source: r[0],
      visits: r[1],
      signups: r[2],
    })),
    utm_sources: (utmSources || []).map(r => ({ label: r[0], visits: r[1] })),
    utm_mediums: (utmMediums || []).map(r => ({ label: r[0], visits: r[1] })),
    utm_campaigns: (utmCampaigns || []).map(r => ({ label: r[0], visits: r[1] })),
    events: (events || []).map(r => ({ event: r[0], count: r[1] })),
    daily_visitors: (dailyVisitors || []).map(r => ({ day: r[0], visitors: r[1], signups: r[2] })),
  })
}
