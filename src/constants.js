// ── THEME & CONSTANTS ──

// Fallback values — overridden at runtime by /api/boe-rate
export let BOE = 3.75
export let RATE = 8 + BOE
export let DAILY_RATE = RATE / 365 / 100

// Called on app load to update with live BoE rate
export async function loadLiveBoeRate() {
  try {
    const res = await fetch('/api/boe-rate')
    if (!res.ok) return
    const data = await res.json()
    BOE = data.boe_rate
    RATE = data.statutory_rate
    DAILY_RATE = data.daily_rate
  } catch {
    // Keep fallback values
  }
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
]

export const FONT = `'DM Sans',system-ui,-apple-system,sans-serif`
export const MONO = `'JetBrains Mono','Fira Code',monospace`

export const TRIAL_DAYS = 7

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
