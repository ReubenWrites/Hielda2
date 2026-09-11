// Shared statutory-interest engine for the serverless API.
//
// Mirrors accruedInterest() in src/utils.js and the copies inside the two
// PDF edge functions. Every surface that tells a client what they owe has
// to agree to the penny, or the client has grounds to dispute all of it.
//
// Underscore-prefixed: a module, not a Vercel function (the Hobby plan caps
// us at 12 functions and we are at the cap).

/** Whole days from a to b, negative if b precedes a. Date-only values
 *  normalise to UTC midnight so a payment dated 2026-09-01 means the same
 *  thing wherever it is read. */
export function dayDiff(a, b) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 864e5)
}

/**
 * Statutory interest accrued on an invoice, walked period by period.
 *
 * Interest is owed on whatever was actually outstanding on each day, so a
 * payment only stops the meter from the day it lands. Multiplying the
 * CURRENT balance by the WHOLE overdue period retroactively erases interest
 * that already accrued on a larger balance, and under-charges every time a
 * part-payment arrives late.
 *
 * @param {object} invoice   needs amount, due_date, amount_paid
 * @param {Array|null} payments  ledger rows [{ amount, paid_on }] for this
 *   invoice. Pass null when unavailable: it falls back to the flat model,
 *   which under-states rather than over-states. Never claim more than we
 *   can evidence.
 * @param {number} dailyRate statutory rate as a daily fraction
 * @param {Date|string|number} asOf  accrue up to here; defaults to now
 */
export function accruedInterest(invoice, payments, dailyRate, asOf) {
  const due = invoice.due_date
  const end = asOf ?? Date.now()
  const totalDays = dayDiff(due, end)
  if (totalDays <= 0) return 0

  const face = Number(invoice.amount) || 0

  if (!Array.isArray(payments)) {
    const owed = Math.max(0, face - (Number(invoice.amount_paid) || 0))
    return round2(owed * dailyRate * totalDays)
  }

  const rows = payments
    .map((p) => ({ on: p.paid_on, amount: Number(p.amount) || 0 }))
    .sort((a, b) => new Date(a.on) - new Date(b.on))

  // Paid on or before the due date: never accrues, just lowers the balance
  // the meter starts from.
  let balance = face
  for (const r of rows) {
    if (dayDiff(r.on, due) >= 0) balance = Math.max(0, balance - r.amount)
  }

  let interest = 0
  let cursor = due
  for (const r of rows) {
    if (dayDiff(r.on, due) >= 0) continue
    if (dayDiff(r.on, end) < 0) break
    const days = dayDiff(cursor, r.on)
    if (days > 0) interest += balance * dailyRate * days
    // Principal first; anything above it is paying down charges, so the
    // balance floors at zero rather than clawing interest back.
    balance = Math.max(0, balance - r.amount)
    cursor = r.on
  }
  const tailDays = dayDiff(cursor, end)
  if (tailDays > 0) interest += balance * dailyRate * tailDays

  return round2(interest)
}

export function round2(n) {
  return Math.round(n * 100) / 100
}

/**
 * Fetch the payment ledger for a set of invoices, grouped by invoice id.
 * Returns {} on failure so callers degrade to the flat (under-stating)
 * model rather than blowing up a chase run.
 */
export async function fetchLedgers(supabase, invoiceIds) {
  if (!invoiceIds?.length) return {}
  try {
    const { data, error } = await supabase
      .from('invoice_payments')
      .select('invoice_id, amount, paid_on')
      .in('invoice_id', invoiceIds)
      .order('paid_on', { ascending: true })
    if (error) return {}
    const byInvoice = {}
    for (const p of data || []) {
      if (!byInvoice[p.invoice_id]) byInvoice[p.invoice_id] = []
      byInvoice[p.invoice_id].push(p)
    }
    // An invoice with no rows must map to [] (an empty ledger), not
    // undefined (no ledger) — the two mean different things here.
    for (const id of invoiceIds) if (!byInvoice[id]) byInvoice[id] = []
    return byInvoice
  } catch {
    return {}
  }
}
