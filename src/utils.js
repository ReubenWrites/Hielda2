import { getDailyRate } from "./constants"

/** Calculate penalty based on invoice amount (Late Payment Act 1998) */
export const penalty = (amount) => {
  if (amount < 1000) return 40
  if (amount < 10000) return 70
  return 100
}

/** Calculate simple interest under the Late Payment of Commercial Debts Act 1998 */
export const calcInterest = (amount, days) => Math.round(amount * getDailyRate() * days * 100) / 100

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
export const chargeableExtras = (inv) => {
  if (inv.status !== "overdue") return 0
  if (inv.no_fines || inv.client_type === "consumer") return 0
  const owed = outstanding(inv)
  if (owed <= 0) return 0
  // The fixed sum tiers on the debt that actually went overdue: payments
  // dated before the due date reduce it (a £1,600 invoice paid down to
  // £390 pre-due earns the £40 tier, not £70).
  const debtAtDue = round2(Math.max(0, Number(inv.amount) - (Number(inv.paid_before_due) || 0)))
  const pen = debtAtDue > 0 ? penalty(debtAtDue) : 0
  return round2(calcInterest(owed, daysLate(inv.due_date)) + pen)
}
