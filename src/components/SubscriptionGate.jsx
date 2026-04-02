import { Btn } from "./ui"
import s from './SubscriptionGate.module.css'

const TRIAL_DAYS = 42

function getTrialDaysRemaining(sub) {
  if (!sub || sub.status !== "trialing") return 0
  const end = new Date(sub.trial_end)
  const now = new Date()
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
}

function isActive(sub) {
  if (!sub) return true // No subscription table = allow access (dev mode)
  if (sub.status === "active") return true
  if (sub.status === "trialing") {
    return new Date(sub.trial_end) > new Date()
  }
  return false
}

export default function SubscriptionGate({ subscription, onUpgrade, children }) {
  const sub = subscription
  const active = isActive(sub)
  const daysLeft = getTrialDaysRemaining(sub)
  const isTrial = sub?.status === "trialing" && active
  const isPastDue = sub?.status === "past_due"

  // Trial banner
  const banner = isTrial ? (
    <div className={s.trialBanner}>
      <span className={s.trialText}>
        Free trial — <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> remaining
      </span>
      <Btn sz="sm" onClick={onUpgrade}>Upgrade</Btn>
    </div>
  ) : isPastDue ? (
    <div className={s.pastDueBanner}>
      <span className={s.pastDueText}>
        Payment failed. Please update your payment method to continue.
      </span>
      <Btn sz="sm" v="danger" onClick={onUpgrade}>Update Payment</Btn>
    </div>
  ) : null

  // Paywall for expired trials
  if (!active) {
    return (
      <div className={s.paywall}>
        <div className={s.paywallIcon}>🛡️</div>
        <h2 className={s.paywallTitle}>
          Your free trial has ended
        </h2>
        <p className={s.paywallDesc}>
          Upgrade to Hielda Pro to continue chasing late payments and protecting your income.
        </p>
        <Btn sz="lg" onClick={onUpgrade}>View Plans & Upgrade</Btn>
      </div>
    )
  }

  return (
    <>
      {banner}
      {children}
    </>
  )
}
