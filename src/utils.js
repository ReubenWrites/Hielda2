import { getDailyRate } from "./constants"

/** Calculate penalty based on invoice amount (Late Payment Act 1998) */
export const penalty = (amount) => {
  if (amount < 1000) return 40
  if (amount < 10000) return 70
  return 100
}

/** Calculate simple interest under the Late Payment of Commercial Debts Act 1998 */
export const calcInterest = (amount, days) => Math.round(amount * getDailyRate() * days * 100) / 100

/** Whole days from a to b (negative if b is before a). Date-only values are
 *  normalised to UTC midnight so a payment dated 2026-09-01 means the same
 *  thing regardless of the reader's timezone. */
const dayDiff = (a, b) => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 864e5)

/**
 * Statutory interest accrued on an invoice, walked period by period.
 *
 * Interest is owed on whatever was actually outstanding on each day, so a
 * payment only stops the meter from the day it lands. The previous version
 * multiplied the CURRENT balance by the WHOLE overdue period, which
 * retroactively erased interest that had already accrued on a larger
 * balance — every late part-payment under-charged the client. On a real
 * invoice (£1,418 for 40 days, then £1,200 for 8, then £200 for 1) that
 * was the difference between £3.16 and £21.42.
 *
 * @param {object} inv       invoice row — needs amount, due_date, amount_paid
 * @param {Array}  payments  ledger rows [{ amount, paid_on }] for THIS invoice.
 *                           Omit it and this falls back to the flat
 *                           calculation, which under-states rather than
 *                           over-states: never claim more than we can prove.
 * @param {Date|string} asOf accrue up to here (settlement date, or now)
 */
export const accruedInterest = (inv, payments, asOf) => {
  const dailyRate = getDailyRate()
  const due = inv.due_date
  const end = asOf ?? Date.now()
  const totalDays = dayDiff(due, end)
  if (totalDays <= 0) return 0

  const face = Number(inv.amount) || 0

  // No ledger to hand: flat accrual on what's outstanding now.
  if (!Array.isArray(payments)) {
    const owed = Math.max(0, face - (Number(inv.amount_paid) || 0))
    return round2(owed * dailyRate * totalDays)
  }

  // A row we can't date can't be placed on the timeline. Left raw, a null
  // date parses as 1970 and silently halves the debt, and an unparseable
  // one poisons every comparison with NaN and zeroes the interest outright.
  // Treat both as having landed on the due date: deterministic, and it
  // under-states rather than over-states, which is the safe direction.
  const rows = payments
    .map((p) => {
      const t = new Date(p.paid_on).getTime()
      return { on: Number.isFinite(t) ? p.paid_on : due, amount: Number(p.amount) || 0 }
    })
    .filter((r) => r.amount > 0)
  // amount_paid can exceed what the ledger accounts for (rows that predate
  // the ledger, an import that set the total without dated rows). Credit
  // the difference at the due date: it lowers the starting balance, so it
  // under-states rather than accruing on money already received.
  const ledgered = rows.reduce((s, r) => s + r.amount, 0)
  const unledgered = round2((Number(inv.amount_paid) || 0) - ledgered)
  if (unledgered > 0) rows.push({ on: due, amount: unledgered })
  rows.sort((a, b) => new Date(a.on) - new Date(b.on))

  // Anything paid on or before the due date never accrues: it reduces the
  // balance the meter starts from.
  let balance = face
  for (const r of rows) {
    if (dayDiff(r.on, due) >= 0) balance = Math.max(0, balance - r.amount)
  }

  let interest = 0
  let cursor = due
  for (const r of rows) {
    if (dayDiff(r.on, due) >= 0) continue      // already credited above
    if (dayDiff(r.on, end) < 0) break          // sorted, so nothing later counts
    const days = dayDiff(cursor, r.on)
    if (days > 0) interest += balance * dailyRate * days
    // Payments clear principal first; anything above it is paying down
    // charges, so the meter stops at zero rather than going negative.
    balance = Math.max(0, balance - r.amount)
    cursor = r.on
  }
  const tailDays = dayDiff(cursor, end)
  if (tailDays > 0) interest += balance * dailyRate * tailDays

  return round2(interest)
}

/** Format as GBP currency */
export const fmt = (amount) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount)

/** Format date to readable string */
export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""

/** Add days to a date */
export const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Generate random invoice reference */
export const generateRef = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let r = "INV-"
  for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)]
  return r
}

/** Calculate days late (0 if not late) */
export const daysLate = (due) => {
  const d = Math.floor((Date.now() - new Date(due).getTime()) / 864e5)
  return d > 0 ? d : 0
}

/** Get today as YYYY-MM-DD string */
export const todayStr = () => new Date().toISOString().split("T")[0]

/** Validate email format */
export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

/** Round a number to 2 decimal places (for monetary values) */
export const round2 = (n) => Math.round(n * 100) / 100

/** Principal still owed on an invoice after partial payments. */
export const outstanding = (inv) =>
  round2(Math.max(0, Number(inv.amount) - (Number(inv.amount_paid) || 0)))

/**
 * Statutory extras (interest + fixed recovery cost) actually chargeable on
 * an invoice right now. Zero unless overdue; zero when fines are waived
 * (no_fines) or the client is a consumer (the Act is B2B only); interest
 * accrues on the outstanding balance, not the original amount, so partial
 * payments stop the meter on what's been paid. The fixed sum tier stays
 * based on the invoiced amount — that's the size of the debt that arose.
 */
export const chargeableExtras = (inv, payments) => {
  if (inv.status !== "overdue") return 0
  if (inv.no_fines || inv.client_type === "consumer") return 0
  const owed = outstanding(inv)
  if (owed <= 0) return 0
  // The fixed sum tiers on the debt that actually went overdue: payments
  // dated before the due date reduce it (a £1,600 invoice paid down to
  // £390 pre-due earns the £40 tier, not £70).
  const debtAtDue = round2(Math.max(0, Number(inv.amount) - (Number(inv.paid_before_due) || 0)))
  const pen = debtAtDue > 0 ? penalty(debtAtDue) : 0
  return round2(accruedInterest(inv, payments) + pen)
}
