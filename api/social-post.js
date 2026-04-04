// Vercel Cron: Daily social media posting + engagement on X/Twitter
// ?mode=post (default) — post one tweet per day
// ?mode=engage — search for relevant conversations, reply and like

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import {
  VOICE, PILLARS, EXAMPLES, HASHTAGS,
  SEARCH_QUERIES, REPLY_TEMPLATES, ENGAGE_RULES,
} from './_social-config.js'

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

function oauthSign(method, url, params = {}) {
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

  const authHeader = 'OAuth ' + ['oauth_consumer_key', 'oauth_nonce', 'oauth_signature', 'oauth_signature_method', 'oauth_timestamp', 'oauth_token', 'oauth_version']
    .sort()
    .map(k => {
      const v = k === 'oauth_signature' ? signature : oauthParams[k]
      return `${percentEncode(k)}="${percentEncode(v)}"`
    })
    .join(', ')

  return authHeader
}

// ── X API helpers ──────────────────────────────────────────────────────────────

async function postTweet(text, replyToId = null) {
  const url = 'https://api.twitter.com/2/tweets'
  const auth = oauthSign('POST', url)
  const body = { text }
  if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.title || JSON.stringify(data))
  return data
}

async function likeTweet(tweetId) {
  // Need the authenticated user's ID first
  const meUrl = 'https://api.twitter.com/2/users/me'
  const meAuth = oauthSign('GET', meUrl)
  const meRes = await fetch(meUrl, { headers: { 'Authorization': meAuth } })
  const meData = await meRes.json()
  if (!meRes.ok) throw new Error('Could not get user ID')
  const userId = meData.data.id

  const url = `https://api.twitter.com/2/users/${userId}/likes`
  const auth = oauthSign('POST', url)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tweet_id: tweetId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.title || JSON.stringify(data))
  return data
}

async function searchTweets(query, maxResults = 10) {
  const baseUrl = 'https://api.twitter.com/2/tweets/search/recent'
  const params = {
    query,
    max_results: String(maxResults),
    'tweet.fields': 'author_id,created_at,public_metrics',
    expansions: 'author_id',
    'user.fields': 'public_metrics,username,location,description',
  }
  const auth = oauthSign('GET', baseUrl, params)
  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')

  const res = await fetch(`${baseUrl}?${qs}`, {
    headers: { 'Authorization': auth },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.title || JSON.stringify(data))
  return data
}

// ── Post mode ──────────────────────────────────────────────────────────────────

function pickPillar(recentPillars = []) {
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

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickExample(pillarId, recentTexts = []) {
  const pool = EXAMPLES[pillarId] || EXAMPLES.relatable
  const unused = pool.filter(t => !recentTexts.includes(t))
  if (unused.length === 0) return pickRandom(pool)
  return pickRandom(unused)
}

function maybeAddHashtags(text) {
  if (Math.random() > 0.4) return text
  const shuffled = [...HASHTAGS].sort(() => Math.random() - 0.5)
  const count = Math.random() > 0.5 ? 2 : 1
  return `${text}\n\n${shuffled.slice(0, count).join(' ')}`
}

function generatePost(pillarId, recentTexts = []) {
  let text = pickExample(pillarId, recentTexts)
  text = maybeAddHashtags(text)
  if (text.length > 280) text = text.slice(0, 277) + '...'
  return text
}

async function handlePost(supabase) {
  let recentPillars = [], recentTexts = []
  if (supabase) {
    const { data: logs } = await supabase
      .from('social_posts')
      .select('pillar, text')
      .order('created_at', { ascending: false })
      .limit(30)
    if (logs) {
      recentPillars = logs.map(l => l.pillar)
      recentTexts = logs.map(l => l.text)
    }
  }

  const pillar = pickPillar(recentPillars)
  const text = generatePost(pillar.id, recentTexts)
  const result = await postTweet(text)

  if (supabase) {
    try {
      await supabase.from('social_posts').insert({
        pillar: pillar.id,
        text,
        tweet_id: result.data?.id || null,
        posted_at: new Date().toISOString(),
      })
    } catch {}
  }

  return { mode: 'post', pillar: pillar.id, text, tweet_id: result.data?.id }
}

// ── Engage mode ────────────────────────────────────────────────────────────────

async function handleEngage(supabase) {
  const results = { replies: 0, likes: 0, errors: [], searched: 0 }

  // Get list of tweet IDs we've already engaged with
  let engagedIds = new Set()
  if (supabase) {
    const { data: past } = await supabase
      .from('social_engagements')
      .select('tweet_id')
      .order('created_at', { ascending: false })
      .limit(200)
    if (past) engagedIds = new Set(past.map(p => p.tweet_id))
  }

  // Pick a random search query
  const query = pickRandom(SEARCH_QUERIES)
  results.searched = query

  let tweets, users
  try {
    const searchResult = await searchTweets(query, 10)
    tweets = searchResult.data || []
    users = Object.fromEntries((searchResult.includes?.users || []).map(u => [u.id, u]))
  } catch (e) {
    return { ...results, error: `Search failed: ${e.message}` }
  }

  if (!tweets.length) return { ...results, message: 'No tweets found for query' }

  // ── Contextual tweet filtering ──
  // Goal: only engage with UK freelancers/SMEs talking about late payment.
  // Skip: American accounts, adult content, healthcare/politics, off-topic rants.

  const UK_SIGNALS = ['uk', 'london', 'manchester', 'birmingham', 'leeds', 'bristol', 'edinburgh',
    'glasgow', 'cardiff', 'belfast', 'liverpool', 'sheffield', 'nottingham', 'england', 'scotland',
    'wales', 'britain', 'british', 'united kingdom', '🇬🇧', 'freelancer uk', 'ltd', 'limited company',
    'hmrc', 'companies house', 'vat', 'self-employed uk', 'contractor uk']

  const US_SIGNALS = ['usa', 'us-based', 'california', 'new york', 'nyc', 'texas', 'florida',
    'chicago', 'la based', 'sf based', 'medicare', 'medicaid', '401k', 'irs', 'w-9', '1099',
    'venmo', 'zelle', 'cashapp', 'american', '🇺🇸', 'y\'all']

  const OFF_TOPIC_SIGNALS = ['onlyfans', 'fansly', 'linktree', 'link in bio', 'dm for',
    'cashapp', 'paypal.me', 'subscribe', 'content creator 18', 'nsfw', '🔞', '💋',
    'trump', 'biden', 'congress', 'democrat', 'republican', 'nhs cuts', 'tory', 'labour',
    'medicare', 'healthcare', 'insurance claim', 'crypto', 'nft', 'web3', 'airdrop']

  const INVOICE_CONTEXT = ['invoice', 'invoic', 'client', 'freelanc', 'contractor', 'payment terms',
    'overdue', 'chase', 'accounts', 'late payment', 'owed', 'paid late', 'not been paid',
    'pay me', 'outstanding', 'debt', 'sme', 'small business', 'self-employed', 'self employed']

  const candidates = tweets.filter(t => {
    if (engagedIds.has(t.id)) return false
    const user = users[t.author_id]
    if (!user) return false

    // Basic follower filter
    const followers = user.public_metrics?.followers_count || 0
    if (followers < ENGAGE_RULES.minFollowers || followers > ENGAGE_RULES.maxFollowers) return false

    // Skip promoted/ad content
    const text = t.text.toLowerCase()
    if (ENGAGE_RULES.avoidKeywords.some(kw => text.includes(kw.toLowerCase()))) return false

    // Combine user bio + location + tweet text for context
    const bio = (user.description || '').toLowerCase()
    const loc = (user.location || '').toLowerCase()
    const allText = `${text} ${bio} ${loc}`

    // Skip obviously American accounts
    if (US_SIGNALS.some(sig => allText.includes(sig)) && !UK_SIGNALS.some(sig => allText.includes(sig))) return false

    // Skip off-topic content (adult, politics, crypto, healthcare)
    if (OFF_TOPIC_SIGNALS.some(sig => allText.includes(sig))) return false

    // Require some invoice/freelance context in the tweet or bio
    const hasInvoiceContext = INVOICE_CONTEXT.some(kw => allText.includes(kw))
    if (!hasInvoiceContext) return false

    return true
  })

  let replyCount = 0
  let likeCount = 0

  for (const tweet of candidates) {
    if (replyCount >= ENGAGE_RULES.maxRepliesPerRun && likeCount >= ENGAGE_RULES.maxLikesPerRun) break

    const user = users[tweet.author_id]
    const username = user?.username || 'there'

    try {
      // Like the tweet — but only if the content is brand-safe
      const tweetText = tweet.text.toLowerCase()
      const isSafeToLike = !(ENGAGE_RULES.noLikeKeywords || []).some(kw => tweetText.includes(kw.toLowerCase()))
      const isLikeableQuery = !(ENGAGE_RULES.likeableQueries) ||
        ENGAGE_RULES.likeableQueries.some(q => query.toLowerCase().includes(q.toLowerCase().replace(/ -is:retweet.*$/, '').replace(/"/g, '')))

      if (likeCount < ENGAGE_RULES.maxLikesPerRun && isSafeToLike && isLikeableQuery) {
        await likeTweet(tweet.id)
        likeCount++

        if (supabase) {
          try {
            await supabase.from('social_engagements').insert({
              tweet_id: tweet.id,
              action: 'like',
              author_username: username,
            })
          } catch {}
        }
      }

      // Reply to some tweets (not all — don't be spammy)
      if (replyCount < ENGAGE_RULES.maxRepliesPerRun && Math.random() < 0.6) {
        // Pick reply type — mostly helpful, occasionally mention the calculator
        let replyText
        if (replyCount > 0 && replyCount % ENGAGE_RULES.replyToPromoRatio === 0) {
          replyText = pickRandom(REPLY_TEMPLATES.calculator)
        } else {
          replyText = pickRandom([...REPLY_TEMPLATES.sympathy, ...REPLY_TEMPLATES.advice])
        }

        // Ensure under 280 chars
        if (replyText.length > 280) replyText = replyText.slice(0, 277) + '...'

        await postTweet(replyText, tweet.id)
        replyCount++

        if (supabase) {
          try {
            await supabase.from('social_engagements').insert({
              tweet_id: tweet.id,
              action: 'reply',
              author_username: username,
              reply_text: replyText,
            })
          } catch {}
        }
      }
    } catch (e) {
      results.errors.push({ tweet_id: tweet.id, error: e.message })
    }
  }

  results.replies = replyCount
  results.likes = likeCount
  return results
}

// ── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!CRON_SECRET) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
    return res.status(500).json({ error: 'X/Twitter API keys not configured' })
  }

  const mode = req.query?.mode || 'post'
  const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null

  try {
    if (mode === 'engage') {
      const result = await handleEngage(supabase)
      return res.status(200).json({ success: true, ...result })
    } else {
      const result = await handlePost(supabase)
      return res.status(200).json({ success: true, ...result })
    }
  } catch (e) {
    console.error(`[social-${mode}] Error:`, e.message)
    return res.status(500).json({ error: e.message })
  }
}
