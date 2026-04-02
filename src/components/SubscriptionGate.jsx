import { colors as c, FONT } from "../constants"
import { Btn } from "./ui"

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
    <div style={{
      padding: "8px 16px",
      background: `linear-gradient(135deg, ${c.acd}, rgba(30,95,160,0.12))`,
      borderRadius: 10,
      fontSize: 12,
      marginBottom: 20,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      border: `1px solid ${c.ac}20`,
    }}>
      <span style={{ color: c.ac, fontWeight: 500 }}>
        Free trial — <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> remaining
      </span>
      <Btn sz="sm" onClick={onUpgrade}>Upgrade</Btn>
    </div>
  ) : isPastDue ? (
    <div style={{
      padding: "8px 16px",
      background: c.ord,
      borderRadius: 10,
      fontSize: 12,
      marginBottom: 20,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      border: `1px solid ${c.or}20`,
    }}>
      <span style={{ color: c.or, fontWeight: 500 }}>
        Payment failed. Please update your payment method to continue.
      </span>
      <Btn sz="sm" v="danger" onClick={onUpgrade}>Update Payment</Btn>
    </div>
  ) : null

  // Paywall for expired trials
  if (!active) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: c.tx, margin: "0 0 8px" }}>
          Your free trial has ended
        </h2>
        <p style={{ color: c.tm, fontSize: 14, lineHeight: 1.6, maxWidth: 400, margin: "0 auto 24px" }}>
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
