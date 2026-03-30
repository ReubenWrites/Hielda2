import { useState, useEffect } from "react"
import { colors as c, FONT } from "../constants"
import { Btn } from "./ui"

const STEPS = [
  {
    title: "Welcome to Hielda!",
    body: "Let's take a quick look around. Hielda chases your unpaid invoices automatically, so you can focus on your work.",
    icon: "🛡️",
  },
  {
    title: "Create an invoice",
    body: "Click 'New Invoice' to create your first invoice. Add your client's details, line items, and payment terms. Hielda will handle the rest.",
    icon: "+",
    highlight: "create",
  },
  {
    title: "Your dashboard",
    body: "This is your command centre. You can see all your invoices at a glance — what's being chased, what's pending, and what's been paid.",
    icon: "◉",
    highlight: "dash",
  },
  {
    title: "Automatic chasing",
    body: "When an invoice goes overdue, Hielda sends up to 19 escalating chase emails on your behalf — from friendly reminders to final notices. You stay the good guy.",
    icon: "📧",
  },
  {
    title: "Your details",
    body: "Head to 'Your Details' to set up your bank details, invoice prefix, and payment terms. These auto-fill every invoice you create.",
    icon: "⚙",
    highlight: "settings",
  },
  {
    title: "You're all set!",
    body: "Create your first invoice and Hielda will take care of the chasing. If you need help, check 'How It Works' in the sidebar.",
    icon: "✓",
  },
]

const TOUR_KEY = (userId) => `hielda_tour_done_${userId}`

export function shouldShowTour(userId) {
  try {
    return !localStorage.getItem(TOUR_KEY(userId))
  } catch {
    return false
  }
}

export default function OnboardingTour({ userId, onDone }) {
  const [step, setStep] = useState(0)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const finish = () => {
    try { localStorage.setItem(TOUR_KEY(userId), "1") } catch {}
    onDone()
  }

  const next = () => {
    if (isLast) { finish(); return }
    setStep(s => s + 1)
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: FONT,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "32px 28px",
        maxWidth: 420, width: "100%", textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", background: c.acd,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, margin: "0 auto 16px",
        }}>
          {current.icon}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: c.tx, margin: "0 0 8px" }}>
          {current.title}
        </h2>

        <p style={{ fontSize: 13, color: c.tm, lineHeight: 1.6, margin: "0 0 24px" }}>
          {current.body}
        </p>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                background: i === step ? c.ac : c.bd,
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {step > 0 && (
            <Btn v="ghost" onClick={() => setStep(s => s - 1)}>Back</Btn>
          )}
          <Btn onClick={next}>{isLast ? "Get Started" : "Next"}</Btn>
          {!isLast && (
            <button
              onClick={finish}
              style={{ background: "none", border: "none", color: c.td, cursor: "pointer", fontSize: 12, fontFamily: FONT }}
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
