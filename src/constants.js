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

// ── Chase ladder ──
//
// Escalation is by WEIGHT, not frequency. The old ladder fired 19 emails
// between day 1 and day 45, tightening to daily — which reads as an
// automated system to be filtered, not as mounting pressure — and then
// stopped dead, leaving the debt to sit in silence forever. Now the
// spacing widens as the debt ages, the informal phase ends at day 30,
// and everything past that is formal and monthly, indefinitely.
export const CHASE_STAGES = [
  // Pre-due reminders
  { id: "reminder_1", label: "Friendly Reminder", dfd: -5, phase: "pre_due", col: "#1e5fa0" },
  { id: "reminder_2", label: "Second Reminder", dfd: -1, phase: "pre_due", col: "#2d72b8" },
  { id: "final_warning", label: "Final Warning", dfd: 0, phase: "pre_due", col: "#b45309" },
  // Chasing — statutory charges apply from day 1, spacing widens
  { id: "first_chase", label: "First Chase", dfd: 1, phase: "chasing", col: "#d97706" },
  { id: "second_chase", label: "Second Chase", dfd: 7, phase: "chasing", col: "#c2410c" },
  { id: "third_chase", label: "Third Chase", dfd: 14, phase: "chasing", col: "#b91c1c" },
  { id: "chase_4", label: "Fourth Chase", dfd: 21, phase: "chasing", col: "#9f1239" },
  // The last informal email. Day 30 also triggers the Letter Before Action
  // prompt to the user — the point where this stops being a chase and
  // starts being a legal process.
  { id: "final_notice", label: "Final Notice", dfd: 30, phase: "chasing", col: "#7f1d1d" },
]

/** Day the informal ladder ends and the formal phase begins. */
export const FORMAL_FROM_DAYS = 30

/** Formal reminders repeat on this cadence, forever, until paid or parked. */
export const FORMAL_INTERVAL_DAYS = 30

/**
 * Stage id for a given day past due, including beyond the enumerated
 * ladder. Past day 30 the stages are generated — formal_1 at day 60,
 * formal_2 at day 90 and so on — so a debt is never left without a next
 * step, and each id stays unique for the chase_log's one-send-per-stage
 * index.
 */
export function stageForDay(daysPastDue) {
  if (daysPastDue > FORMAL_FROM_DAYS) {
    const cycle = Math.floor((daysPastDue - FORMAL_FROM_DAYS) / FORMAL_INTERVAL_DAYS)
    if (cycle >= 1) {
      return {
        id: `formal_${cycle}`,
        label: `Formal Reminder ${cycle}`,
        dfd: FORMAL_FROM_DAYS + cycle * FORMAL_INTERVAL_DAYS,
        phase: "formal",
        col: "#18181b",
      }
    }
  }
  let match = CHASE_STAGES[0]
  for (const s of CHASE_STAGES) if (s.dfd <= daysPastDue) match = s
  return match
}

/** Look up any stage id, enumerated or generated. */
export function stageById(id) {
  const known = CHASE_STAGES.find((s) => s.id === id)
  if (known) return known
  const m = /^formal_(\d+)$/.exec(id || "")
  if (m) {
    const cycle = Number(m[1])
    return {
      id, label: `Formal Reminder ${cycle}`,
      dfd: FORMAL_FROM_DAYS + cycle * FORMAL_INTERVAL_DAYS,
      phase: "formal", col: "#18181b",
    }
  }
  return null
}

/**
 * Response window for a Letter Before Action.
 *
 * Company-to-company sits outside any pre-action protocol and 14 days is
 * the usual reasonable period — the common case here, since the Act is
 * B2B. But the Pre-Action Protocol for Debt Claims governs a business
 * claiming against an INDIVIDUAL, and that includes sole traders: there
 * the window is 30 days, and giving less can make a claim procedurally
 * defective. So 14 by default, 30 whenever we know the debtor is a sole
 * trader, and the letter says so where it matters.
 */
export function lbaResponseDays(invoice) {
  return invoice?.client_entity === "sole_trader" ? 30 : 14
}

/**
 * Where an invoice sits in its life, which is what the user needs to act
 * on. Derived rather than stored, so it can never drift out of sync.
 *
 *  pre_due  — not yet due
 *  chasing  — 1 to 30 days late, informal emails, charges accruing
 *  formal   — 30+ days: a Letter Before Action is available or has been
 *             sent and its clock is still running
 *  decision — the LBA window has expired; the user must choose whether to
 *             claim, instruct someone, or let it lie
 *  parked   — user stopped the chasing; still owed, still accruing
 *  settled  — paid or written off
 */
export function invoicePhase(invoice, daysPastDue) {
  if (!invoice) return "pre_due"
  if (invoice.status === "paid") return "settled"
  if (invoice.parked_at) return "parked"
  const dl = typeof daysPastDue === "number"
    ? daysPastDue
    : Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 864e5)
  if (dl <= 0) return "pre_due"
  if (invoice.lba_sent_at) {
    const deadline = invoice.lba_deadline
    if (deadline && Date.now() > new Date(deadline).getTime() + 864e5) return "decision"
    return "formal"
  }
  return dl >= FORMAL_FROM_DAYS ? "formal" : "chasing"
}

export const PHASE_LABELS = {
  pre_due: "Not yet due",
  chasing: "Being chased",
  formal: "Formal recovery",
  decision: "Decision needed",
  parked: "Parked",
  settled: "Settled",
}

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
