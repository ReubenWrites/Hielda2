// Vercel Serverless Function: Fetch current Bank of England base rate
// Caches for 24 hours to avoid hammering the BoE endpoint

const BOE_URL = 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp'
const FALLBACK_RATE = 3.75
import { BASE_RATE_HISTORY, mergeBaseRateHistory } from './_baseRates.js'

// In-memory cache (persists across warm invocations)
let cached = { rate: null, fetchedAt: 0, history: null }
const CACHE_MS = 24 * 60 * 60 * 1000 // 24 hours

async function fetchBoeRate() {
  // Check cache first
  if (cached.rate !== null && Date.now() - cached.fetchedAt < CACHE_MS) {
    return { rate: cached.rate, cached: true, changedOn: cached.changedOn, referenceRate: cached.referenceRate, refDate: cached.refDate, history: cached.history }
  }

  try {
    // Eight years of base rate data: the Act's reference rate for an
    // old invoice (claims go back six years) needs the rate on a 30 June
    // or 31 December years ago, not just the latest figure.
    const now = new Date()
    const yearAgo = new Date(now.getFullYear() - 8, now.getMonth(), now.getDate())
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

    // Walk back to find when the current rate started, and the rate in
    // force on the Act's last reference date (30 June or 31 December):
    // the statutory rate is 8% over THAT rate for the following half-year,
    // not over today's base rate. Rows are "DD MMM YYYY, rate".
    const rows = lines.map((l) => {
      const [d, r] = l.split(',')
      return { date: new Date(d.trim()), rate: parseFloat((r || '').trim()) }
    }).filter((x) => !isNaN(x.date.getTime()) && !isNaN(x.rate))
    let changedOn = null
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].rate !== rate) break
      changedOn = rows[i].date
    }
    const today = new Date()
    const refDate = today.getMonth() >= 6
      ? new Date(Date.UTC(today.getFullYear(), 5, 30))
      : new Date(Date.UTC(today.getFullYear() - 1, 11, 31))
    const onOrBefore = rows.filter((x) => x.date <= refDate)
    const referenceRate = onOrBefore.length ? onOrBefore[onOrBefore.length - 1].rate : null
    // Collapse the daily series to the dates the rate changed.
    const changes = []
    for (const x of rows) {
      if (!changes.length || changes[changes.length - 1].rate !== x.rate) {
        changes.push({ from: x.date.toISOString().slice(0, 10), rate: x.rate })
      }
    }
    const history = mergeBaseRateHistory(changes)

    // Update cache
    cached = { rate, fetchedAt: Date.now(), changedOn, referenceRate, refDate, history }

    return { rate, cached: false, date: parts[0].trim(), changedOn, referenceRate, refDate, history }
  } catch (e) {
    console.error('BoE rate fetch failed:', e.message)

    // Return cached rate if available, otherwise fallback
    if (cached.rate !== null) {
      return { rate: cached.rate, cached: true, stale: true, changedOn: cached.changedOn, referenceRate: cached.referenceRate, refDate: cached.refDate, history: cached.history }
    }

    return { rate: FALLBACK_RATE, cached: false, fallback: true, history: BASE_RATE_HISTORY }
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
    // When the base rate last changed, and the rate the Act fixes for the
    // current half-year (base rate on the last 30 June / 31 December).
    changed_on: result.changedOn ? new Date(result.changedOn).toISOString().slice(0, 10) : null,
    reference_rate: result.referenceRate ?? null,
    reference_date: result.refDate ? new Date(result.refDate).toISOString().slice(0, 10) : null,
    // Base rate changes since 2018, for the Act's per-invoice reference rate.
    history: result.history || BASE_RATE_HISTORY,
    fetched_at: new Date(cached.fetchedAt || Date.now()).toISOString(),
  })
}

// Export for use by other API routes
export { fetchBoeRate, FALLBACK_RATE }
