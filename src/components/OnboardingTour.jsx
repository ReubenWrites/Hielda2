import { useState } from "react"
import { Btn } from "./ui"
import s from "./OnboardingTour.module.css"

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
    <div className={s.overlay}>
      <div className={s.dialog}>
        <div className={s.iconCircle}>
          {current.icon}
        </div>

        <h2 className={s.title}>
          {current.title}
        </h2>

        <p className={s.body}>
          {current.body}
        </p>

        {/* Progress dots */}
        <div className={s.dots}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`${s.dot} ${i === step ? s.dotActive : ""}`}
            />
          ))}
        </div>

        <div className={s.actions}>
          {step > 0 && (
            <Btn v="ghost" onClick={() => setStep(s => s - 1)}>Back</Btn>
          )}
          <Btn onClick={next}>{isLast ? "Get Started" : "Next"}</Btn>
          {!isLast && (
            <button
              onClick={finish}
              className={s.skipBtn}
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
