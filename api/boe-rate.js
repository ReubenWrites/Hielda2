// Vercel Serverless Function: Fetch current Bank of England base rate
// Caches for 24 hours to avoid hammering the BoE endpoint

const BOE_URL = 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp'
const FALLBACK_RATE = 3.75

// In-memory cache (persists across warm invocations)
let cached = { rate: null, fetchedAt: 0 }
const CACHE_MS = 24 * 60 * 60 * 1000 // 24 hours

async function fetchBoeRate() {
  // Check cache first
  if (cached.rate !== null && Date.now() - cached.fetchedAt < CACHE_MS) {
    return { rate: cached.rate, cached: true }
  }

  try {
    // Fetch the last 12 months of BoE base rate data
    const now = new Date()
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const fromDate = `${String(yearAgo.getDate()).padStart(2, '0')}/${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][yearAgo.getMonth()]}/${yearAgo.getFullYear()}`

    const url = `${BOE_URL}?SeriesCodes=IUDBEDR&Datefrom=${fromDate}&Dateto=now&UsingCodes=Y&csv.x=yes`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Hielda/1.0 (invoice management)' },
    })

    if (!res.ok) {
      throw new Error(`BoE returned ${res.status}`)
    }

    const csv = await res.text()

    // Parse CSV — format is: DATE, IUDBEDR
    // Skip header rows, get the last non-empty line
    const lines = csv.trim().split('\n').filter(l => l.trim() && !l.startsWith('DATE'))

    if (lines.length === 0) {
      throw new Error('No data rows in BoE response')
    }

    // Get the most recent rate (last line)
    const lastLine = lines[lines.length - 1]
    const parts = lastLine.split(',')

    if (parts.length < 2) {
      throw new Error('Unexpected CSV format')
    }

    const rate = parseFloat(parts[1].trim())

    if (isNaN(rate) || rate < 0 || rate > 30) {
      throw new Error(`Unreasonable rate value: ${parts[1]}`)
    }

    // Update cache
    cached = { rate, fetchedAt: Date.now() }

    return { rate, cached: false, date: parts[0].trim() }
  } catch (e) {
    console.error('BoE rate fetch failed:', e.message)

    // Return cached rate if available, otherwise fallback
    if (cached.rate !== null) {
      return { rate: cached.rate, cached: true, stale: true }
    }

    return { rate: FALLBACK_RATE, cached: false, fallback: true }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const result = await fetchBoeRate()
  const statutoryRate = 8 + result.rate
  const dailyRate = statutoryRate / 365 / 100

  // Cache at CDN level too (1 hour public, 24 hours stale-while-revalidate)
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')

  return res.status(200).json({
    boe_rate: result.rate,
    statutory_rate: statutoryRate,
    daily_rate: dailyRate,
    cached: result.cached || false,
    fallback: result.fallback || false,
    fetched_at: new Date(cached.fetchedAt || Date.now()).toISOString(),
  })
}

// Export for use by other API routes
export { fetchBoeRate, FALLBACK_RATE }
