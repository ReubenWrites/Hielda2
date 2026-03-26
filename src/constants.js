// ── THEME & CONSTANTS ──

export const BOE = 3.75
export const RATE = 8 + BOE
export const DAILY_RATE = RATE / 365 / 100

export const TERMS = [
  { l: "14 days", d: 14 },
  { l: "30 days (standard)", d: 30 },
  { l: "45 days", d: 45 },
  { l: "60 days (legal max)", d: 60 },
]

export const CHASE_STAGES = [
  { id: "reminder_1", label: "Friendly Reminder", dfd: -5, col: "#1e5fa0" },
  { id: "reminder_2", label: "Second Reminder", dfd: -1, col: "#2d72b8" },
  { id: "first_chase", label: "First Chase", dfd: 1, col: "#d97706" },
  { id: "second_chase", label: "Second Chase + Interest", dfd: 14, col: "#c2410c" },
  { id: "final_notice", label: "Final Notice", dfd: 30, col: "#9f1239" },
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
