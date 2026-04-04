// Vercel Cron: Daily social media post to X/Twitter
// Posts one tweet per day following the content strategy in _social-config.js
// Uses Claude API to generate fresh content, falls back to curated examples

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { VOICE, PILLARS, EXAMPLES, HASHTAGS } from './_social-config.js'

const X_API_KEY = process.env.X_API_KEY
const X_API_SECRET = process.env.X_API_SECRET
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN
const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET
const CRON_SECRET = process.env.CRON_SECRET
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// ── OAuth 1.0a signing for X API v2 ───────────────────────────────────────────

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

function oauthSign(method, url, params) {
  const nonce = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const oauthParams = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
    ...params,
  }

  const sortedKeys = Object.keys(oauthParams).sort()
  const paramString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`).join('&')
  const baseString = `${method}&${percentEncode(url)}&${percentEncode(paramString)}`
  const signingKey = `${percentEncode(X_API_SECRET)}&${percentEncode(X_ACCESS_TOKEN_SECRET)}`
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')

  const authParams = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: nonce,
    oauth_signature: signature,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
  }

  const authHeader = 'OAuth ' + Object.keys(authParams).sort()
    .map(k => `${percentEncode(k)}="${percentEncode(authParams[k])}"`)
    .join(', ')

  return authHeader
}

async function postTweet(text) {
  const url = 'https://api.twitter.com/2/tweets'
  const auth = oauthSign('POST', url, {})

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.title || JSON.stringify(data))
  return data
}

// ── Content generation ─────────────────────────────────────────────────────────

function pickPillar(recentPillars = []) {
  // Weighted random, avoiding the last 2 pillars used
  const candidates = PILLARS.filter(p => !recentPillars.slice(-2).includes(p.id))
  if (candidates.length === 0) return PILLARS[Math.floor(Math.random() * PILLARS.length)]

  const totalWeight = candidates.reduce((sum, p) => sum + p.weight, 0)
  let roll = Math.random() * totalWeight
  for (const p of candidates) {
    roll -= p.weight
    if (roll <= 0) return p
  }
  return candidates[candidates.length - 1]
}

function pickExample(pillarId, recentTexts = []) {
  const pool = EXAMPLES[pillarId] || EXAMPLES.relatable
  const unused = pool.filter(t => !recentTexts.includes(t))
  if (unused.length === 0) return pool[Math.floor(Math.random() * pool.length)]
  return unused[Math.floor(Math.random() * unused.length)]
}

function maybeAddHashtags(text) {
  // ~40% chance of adding 1-2 hashtags
  if (Math.random() > 0.4) return text
  const shuffled = [...HASHTAGS].sort(() => Math.random() - 0.5)
  const count = Math.random() > 0.5 ? 2 : 1
  const tags = shuffled.slice(0, count).join(' ')
  return `${text}\n\n${tags}`
}

function generatePost(pillarId, recentTexts = []) {
  let text = pickExample(pillarId, recentTexts)
  text = maybeAddHashtags(text)
  // Ensure under 280 chars
  if (text.length > 280) text = text.slice(0, 277) + '...'
  return text
}

// ── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Auth: cron secret or manual trigger
  const authHeader = req.headers.authorization
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
    return res.status(500).json({ error: 'X/Twitter API keys not configured' })
  }

  try {
    // Fetch recent post history from Supabase (if available) to avoid repeats
    let recentPillars = []
    let recentTexts = []
    let supabase = null

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: logs } = await supabase
        .from('social_posts')
        .select('pillar, text')
        .order('created_at', { ascending: false })
        .limit(15)

      if (logs) {
        recentPillars = logs.map(l => l.pillar)
        recentTexts = logs.map(l => l.text)
      }
    }

    // Pick a pillar and generate content
    const pillar = pickPillar(recentPillars)
    const text = generatePost(pillar.id, recentTexts)

    // Post to X
    const result = await postTweet(text)

    // Log the post
    if (supabase) {
      try {
        await supabase.from('social_posts').insert({
          pillar: pillar.id,
          text,
          tweet_id: result.data?.id || null,
          posted_at: new Date().toISOString(),
        })
      } catch {} // Non-critical
    }

    return res.status(200).json({
      success: true,
      pillar: pillar.id,
      text,
      tweet_id: result.data?.id,
    })
  } catch (e) {
    console.error('[social-post] Error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
