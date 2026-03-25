import { DAILY_RATE } from "./constants"

/** Calculate penalty based on invoice amount */
export const penalty = (amount) => {
  if (amount < 1000) return 40
  if (amount < 10000) return 70
  return 100
}

/** Calculate compound interest */
export const calcInterest = (amount, days) => amount * DAILY_RATE * days

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
