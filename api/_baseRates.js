// Bank of England base rate history and the Late Payment Act's reference
// rate rule. Shared by the browser (via src/constants.js), the Vercel API
// functions and, as a copied snippet, the two PDF edge functions.
//
// The law: statutory interest is 8% over the "reference rate", which is
// the base rate in force on 30 June (for interest that starts to run
// between 1 July and 31 December) or 31 December (for interest starting
// between 1 January and 30 June) - Late Payment of Commercial Debts
// (Rate of Interest) (No. 3) Order 2002, art. 4. Interest starts to run
// the day after the invoice is due. The rate is fixed for that debt;
// later base-rate changes do not alter it (Crema v Cenkos [2011] EWCA
// Civ 10). Using "today's" base rate, as the engine did until Oct 2026,
// over- or under-charges whenever the Bank moves mid half-year.

// Every base rate change since 2018 (BoE series IUDBEDR). Kept as the
// fallback and extended at runtime from /api/boe-rate; new entries only
// matter for reference dates after the last one here.
export const BASE_RATE_HISTORY = [
  { from: "2018-08-02", rate: 0.75 },
  { from: "2020-03-11", rate: 0.25 },
  { from: "2020-03-19", rate: 0.1 },
  { from: "2021-12-16", rate: 0.25 },
  { from: "2022-02-03", rate: 0.5 },
  { from: "2022-03-17", rate: 0.75 },
  { from: "2022-05-05", rate: 1 },
  { from: "2022-06-16", rate: 1.25 },
  { from: "2022-08-04", rate: 1.75 },
  { from: "2022-09-22", rate: 2.25 },
  { from: "2022-11-03", rate: 3 },
  { from: "2022-12-15", rate: 3.5 },
  { from: "2023-02-02", rate: 4 },
  { from: "2023-03-23", rate: 4.25 },
  { from: "2023-05-11", rate: 4.5 },
  { from: "2023-06-22", rate: 5 },
  { from: "2023-08-03", rate: 5.25 },
  { from: "2024-08-01", rate: 5 },
  { from: "2024-11-07", rate: 4.75 },
  { from: "2025-02-06", rate: 4.5 },
  { from: "2025-05-08", rate: 4.25 },
  { from: "2025-08-07", rate: 4 },
  { from: "2025-12-18", rate: 3.75 },
]

let _history = BASE_RATE_HISTORY

/** Replace the working history with a longer one fetched from the BoE. */
export function setBaseRateHistory(history) {
  if (Array.isArray(history) && history.length >= BASE_RATE_HISTORY.length) _history = history
}
export function getBaseRateHistory() { return _history }

/** Merge fetched changes into the static table (dedupe by date, sort). */
export function mergeBaseRateHistory(fetched) {
  const map = new Map(BASE_RATE_HISTORY.map((h) => [h.from, h.rate]))
  for (const h of fetched || []) if (h && h.from && Number.isFinite(h.rate)) map.set(h.from, h.rate)
  return [...map.entries()].map(([from, rate]) => ({ from, rate })).sort((a, b) => (a.from < b.from ? -1 : 1))
}

const iso = (d) => {
  if (d == null || d === "") return null
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
  const x = new Date(d)
  return isNaN(x) ? null : x.toISOString().slice(0, 10)
}

/** Base rate in force on a date (ISO yyyy-mm-dd). */
export function baseRateOn(date, history = _history) {
  const d = iso(date)
  if (!d) return history[history.length - 1].rate
  let rate = history[0].rate
  for (const h of history) { if (h.from <= d) rate = h.rate; else break }
  return rate
}

/** The Act's reference date for interest starting to run on `startDate`. */
export function referenceDateFor(startDate) {
  const d = iso(startDate)
  if (!d) return null
  const y = Number(d.slice(0, 4))
  const m = Number(d.slice(5, 7))
  return m >= 7 ? `${y}-06-30` : `${y - 1}-12-31`
}

/** Statutory rate (% p.a.) for an invoice with this due date. */
export function statutoryRateFor(dueDate, history = _history) {
  const due = iso(dueDate)
  if (!due) return 8 + history[history.length - 1].rate
  // Interest starts the day after the due date.
  const start = new Date(due + "T00:00:00Z")
  start.setUTCDate(start.getUTCDate() + 1)
  const ref = referenceDateFor(start.toISOString().slice(0, 10))
  return Math.round((8 + baseRateOn(ref, history)) * 100) / 100
}

/** Same, as a daily fraction. */
export function dailyRateFor(dueDate, history = _history) {
  return statutoryRateFor(dueDate, history) / 365 / 100
}
