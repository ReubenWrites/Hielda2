import { useState } from "react"
import { supabase } from "../supabase"
import { Card, Btn, Badge, ErrorBanner } from "./ui"
import s from "./Billing.module.css"

const TRIAL_DAYS = 42

function getTrialDaysRemaining(sub) {
  if (!sub || sub.status !== "trialing") return 0
  const end = new Date(sub.trial_end)
  return Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24)))
}

const STATUS_COLORS = {
  trialing: "var(--ac)",
  active: "var(--gn)",
  past_due: "var(--or)",
  canceled: "var(--tm)",
  expired: "var(--td)",
}

const STATUS_LABELS = {
  trialing: "Free Trial",
  active: "Active",
  past_due: "Past Due",
  canceled: "Cancelled",
  expired: "Expired",
}

export default function Billing({ subscription, userId, onUpdate, isMobile }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const sub = subscription
  const statusKey = sub?.status || "expired"
  const statusLabel = STATUS_LABELS[statusKey]
  const statusColor = STATUS_COLORS[statusKey]
  const daysLeft = getTrialDaysRemaining(sub)
  const isTrial = sub?.status === "trialing"
  const isActive = sub?.status === "active"

  const handleCheckout = async (plan) => {
    setLoading(true)
    setError("")
    try {
      const priceIdKey = plan === "annual" ? "VITE_STRIPE_PRICE_ID_ANNUAL" : "VITE_STRIPE_PRICE_ID_MONTHLY"
      const priceId = import.meta.env[priceIdKey]

      if (!priceId) {
        setError("Payment is unavailable right now. Please contact support@hielda.com.")
        setLoading(false)
        return
      }

      const { data, error: fnErr } = await supabase.functions.invoke("create-checkout-session", {
        body: { price_id: priceId, user_id: userId },
      })

      if (fnErr) {
        const status = fnErr.context?.status || fnErr.status || "?"
        const body = await fnErr.context?.text?.() || fnErr.context?.body || ""
        throw new Error(`HTTP ${status}: ${body || fnErr.message}`)
      }
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (e) {
      setError("Failed to start checkout: " + e.message)
    }
    setLoading(false)
  }

  const handlePortal = async () => {
    setLoading(true)
    setError("")
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-portal-session", {
        body: { user_id: userId },
      })
      if (fnErr) throw fnErr
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (e) {
      setError("Failed to open billing portal: " + e.message)
    }
    setLoading(false)
  }

  return (
    <div>
      <div className={s.headerWrap}>
        <h1 className={s.title}>Your Account</h1>
        <p className={s.subtitle}>Manage your subscription and billing.</p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {/* Current plan status */}
      <Card style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div>
          <div className={s.planLabel}>Current Plan</div>
          <div className={s.planNameRow}>
            <span className={s.planName}>Hielda Pro</span>
            {statusLabel && <Badge color={statusColor}>{statusLabel}</Badge>}
          </div>
          {isTrial && (
            <div className={s.trialInfo}>
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining in your free trial
            </div>
          )}
          {isActive && sub?.current_period_end && (
            <div className={s.billingDate}>
              Next billing date: {new Date(sub.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
        </div>
        {isActive && (
          <Btn v="ghost" onClick={handlePortal} dis={loading} sz="sm">
            Manage Billing
          </Btn>
        )}
      </Card>

      {/* Pricing cards - show when not actively subscribed */}
      {!isActive && (
        <>
          <h2 className={s.pricingTitle}>
            {isTrial ? "Choose a plan before your trial ends" : "Choose a plan to continue"}
          </h2>

          <div className={s.pricingGrid}>
            {/* Monthly */}
            <Card style={{ textAlign: "center", padding: "28px 24px" }}>
              <div className={s.cardLabel}>Monthly</div>
              <div className={s.price}>&pound;3.99</div>
              <div className={s.perPeriod}>per month</div>
              <Btn onClick={() => handleCheckout("monthly")} dis={loading} style={{ width: "100%", justifyContent: "center" }}>
                {loading ? "Loading..." : "Subscribe Monthly"}
              </Btn>
            </Card>

            {/* Annual */}
            <Card style={{ textAlign: "center", padding: "28px 24px", borderColor: "var(--ac)", position: "relative" }}>
              <div className={s.bestValue}>Best Value</div>
              <div className={s.cardLabel}>Annual</div>
              <div className={s.price}>&pound;34.99</div>
              <div className={s.annualSub}>per year (save 27%)</div>
              <div className={s.annualSave}>One late payment fee covers your entire year. Everything else is profit.</div>
              <Btn onClick={() => handleCheckout("annual")} dis={loading} style={{ width: "100%", justifyContent: "center" }}>
                {loading ? "Loading..." : "Subscribe Annually"}
              </Btn>
            </Card>
          </div>
        </>
      )}

      {/* Features list */}
      <Card>
        <h3 className={s.featuresHeading}>
          What's included in Hielda Pro
        </h3>
        {[
          "Hielda chases on your behalf \u2014 you stay the good guy",
          "19-stage escalation from friendly reminder to final notice",
          "Statutory interest & penalty calculations (UK Late Payment Act 1998)",
          "Automatic chase emails at every stage",
          "Check-in before every step \u2014 you stay in full control",
          "PDF invoice generation & download",
          "Chase timeline & audit trail",
          "Priority email support",
        ].map((feature) => (
          <div key={feature} className={s.featureRow}>
            <span className={s.featureCheck}>{"\u2713"}</span>
            {feature}
          </div>
        ))}
      </Card>

      <div className={s.footer}>
        <a href="mailto:support@hielda.com" className={s.footerLink}>support@hielda.com</a>
        {" \u00b7 "}
        <a href="/privacy" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("hielda:show-privacy")) }} className={s.footerLink}>Privacy Policy</a>
      </div>
    </div>
  )
}
