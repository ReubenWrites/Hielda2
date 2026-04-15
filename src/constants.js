// ── THEME & CONSTANTS ──

// Rate state — updated asynchronously by loadLiveBoeRate()
// Components should subscribe via the callback to re-render on change.
let _boe = 3.75
let _rate = 8 + _boe
let _dailyRate = _rate / 365 / 100
let _listeners = []

export function getBoe() { return _boe }
export function getRate() { return _rate }
export function getDailyRate() { return _dailyRate }

// REMOVED: Legacy named exports (BOE, RATE, DAILY_RATE) were bound at
// module evaluation time and never updated after loadLiveBoeRate() resolved.
// All code should use getBoe(), getRate(), getDailyRate() instead.

export function onRateChange(cb) {
  _listeners.push(cb)
  return () => { _listeners = _listeners.filter(l => l !== cb) }
}

// Called on app load to update with live BoE rate.
// Updates all three values atomically then notifies listeners.
let _loading = null
export function loadLiveBoeRate() {
  if (_loading) return _loading // Deduplicate concurrent calls
  _loading = (async () => {
    try {
      const res = await fetch('/api/boe-rate')
      if (!res.ok) return
      const data = await res.json()
      // Atomic update — compute all values before assigning
      const newBoe = data.boe_rate
      const newRate = data.statutory_rate
      const newDailyRate = data.daily_rate
      _boe = newBoe
      _rate = newRate
      _dailyRate = newDailyRate
      _listeners.forEach(cb => cb({ boe: _boe, rate: _rate, dailyRate: _dailyRate }))
    } catch {
      // Keep fallback values
    } finally {
      _loading = null
    }
  })()
  return _loading
}

export const TERMS = [
  { l: "7 days", d: 7 },
  { l: "14 days", d: 14 },
  { l: "30 days (standard)", d: 30 },
  { l: "45 days", d: 45 },
  { l: "60 days (legal max)", d: 60 },
  { l: "Custom", d: -1 },
]

export const CHASE_STAGES = [
  // Pre-due reminders
  { id: "reminder_1", label: "Friendly Reminder", dfd: -5, col: "#1e5fa0" },
  { id: "reminder_2", label: "Second Reminder", dfd: -1, col: "#2d72b8" },
  { id: "final_warning", label: "Final Warning", dfd: 0, col: "#b45309" },
  // Overdue: fines & interest applied
  { id: "first_chase", label: "First Chase", dfd: 1, col: "#d97706" },
  { id: "second_chase", label: "Second Chase", dfd: 6, col: "#c2410c" },
  { id: "third_chase", label: "Third Chase", dfd: 9, col: "#b91c1c" },
  // Every 2 days
  { id: "chase_4", label: "Chase 4", dfd: 11, col: "#9f1239" },
  { id: "chase_5", label: "Chase 5", dfd: 13, col: "#9f1239" },
  { id: "chase_6", label: "Chase 6", dfd: 15, col: "#9f1239" },
  { id: "chase_7", label: "Chase 7", dfd: 17, col: "#9f1239" },
  { id: "chase_8", label: "Chase 8", dfd: 19, col: "#9f1239" },
  { id: "chase_9", label: "Chase 9", dfd: 21, col: "#9f1239" },
  { id: "chase_10", label: "Chase 10", dfd: 23, col: "#9f1239" },
  { id: "chase_11", label: "Chase 11", dfd: 25, col: "#9f1239" },
  // Daily escalation warnings
  { id: "escalation_1", label: "Escalation Warning 1", dfd: 26, col: "#7f1d1d" },
  { id: "escalation_2", label: "Escalation Warning 2", dfd: 27, col: "#7f1d1d" },
  { id: "escalation_3", label: "Escalation Warning 3", dfd: 28, col: "#7f1d1d" },
  { id: "escalation_4", label: "Escalation Warning 4", dfd: 29, col: "#7f1d1d" },
  { id: "final_notice", label: "Final Notice", dfd: 30, col: "#7f1d1d" },
  // Final recovery period — every 2 days
  { id: "recovery_1", label: "Recovery Notice 1", dfd: 31, col: "#450a0a" },
  { id: "recovery_2", label: "Recovery Notice 2", dfd: 33, col: "#450a0a" },
  { id: "recovery_3", label: "Recovery Notice 3", dfd: 35, col: "#450a0a" },
  { id: "recovery_4", label: "Recovery Notice 4", dfd: 37, col: "#450a0a" },
  // Imminent escalation — daily
  { id: "recovery_5", label: "Imminent Escalation 1", dfd: 38, col: "#27272a" },
  { id: "recovery_6", label: "Imminent Escalation 2", dfd: 39, col: "#27272a" },
  { id: "recovery_7", label: "Imminent Escalation 3", dfd: 40, col: "#27272a" },
  { id: "recovery_8", label: "Imminent Escalation 4", dfd: 41, col: "#27272a" },
  { id: "recovery_9", label: "Imminent Escalation 5", dfd: 42, col: "#27272a" },
  { id: "recovery_10", label: "Imminent Escalation 6", dfd: 43, col: "#27272a" },
  { id: "recovery_11", label: "Imminent Escalation 7", dfd: 44, col: "#27272a" },
  // Final recovery notice
  { id: "recovery_final", label: "Final Recovery Notice", dfd: 45, col: "#18181b" },
]

export const FONT = `'DM Sans',system-ui,-apple-system,sans-serif`
export const MONO = `'JetBrains Mono','Fira Code',monospace`

export const TRIAL_DAYS = 42

export const REFERRAL_STATUSES = {
  link_sent: { label: "Invite Sent", color: "#94a3b8", desc: "Hasn't signed up yet" },
  signed_up: { label: "Signed Up", color: "#1e5fa0", desc: "Not yet subscribed" },
  subscribed: { label: "Subscribed", color: "#b45309", desc: "Building toward threshold" },
  eligible: { label: "Eligible", color: "#16a34a", desc: "Payout pending" },
  paid_out: { label: "Paid", color: "#16a34a", desc: "Payout complete" },
}

export const REFERRAL_THRESHOLD = 10
export const REFERRAL_REWARD = 10
export const REFERRAL_BONUS_COUNT = 10
export const REFERRAL_BONUS_AMOUNT = 50

export const colors = {
  bg: "#f1f3f6",
  sf: "#fff",
  sfh: "#f6f7fa",
  bd: "#dce1e8",
  bdl: "#eceef3",
  tx: "#0f172a",
  tm: "#64748b",
  td: "#94a3b8",
  ac: "#1e5fa0",
  acl: "#3b82c4",
  acd: "rgba(30,95,160,0.07)",
  gn: "#16a34a",
  gnd: "rgba(22,163,74,0.07)",
  or: "#d97706",
  ord: "rgba(217,119,6,0.07)",
  am: "#b45309",
  amd: "rgba(180,83,9,0.07)",
  go: "#a16207",
  god: "rgba(161,98,7,0.07)",
  w: "#fff",
}
