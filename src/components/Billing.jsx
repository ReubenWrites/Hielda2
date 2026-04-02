import { useState } from "react"
import { supabase } from "../supabase"
import { colors as c, FONT, MONO } from "../constants"
import { Card, Btn, Badge, ErrorBanner } from "./ui"

const TRIAL_DAYS = 42

function getTrialDaysRemaining(sub) {
  if (!sub || sub.status !== "trialing") return 0
  const end = new Date(sub.trial_end)
  return Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24)))
}

const STATUS_LABELS = {
  trialing: { label: "Free Trial", color: c.ac },
  active: { label: "Active", color: c.gn },
  past_due: { label: "Past Due", color: c.or },
  canceled: { label: "Cancelled", color: c.tm },
  expired: { label: "Expired", color: c.td },
}

export default function Billing({ subscription, userId, onUpdate, isMobile }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const sub = subscription
  const status = sub ? STATUS_LABELS[sub.status] || STATUS_LABELS.expired : null
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.tx, margin: "0 0 5px" }}>Your Account</h1>
        <p style={{ color: c.tm, margin: 0, fontSize: 13 }}>Manage your subscription and billing.</p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {/* Current plan status */}
      <Card style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div>
          <div style={{ fontSize: 12, color: c.tm, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            Current Plan
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: c.tx }}>Hielda Pro</span>
            {status && <Badge color={status.color}>{status.label}</Badge>}
          </div>
          {isTrial && (
            <div style={{ fontSize: 12, color: c.ac, marginTop: 4 }}>
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining in your free trial
            </div>
          )}
          {isActive && sub?.current_period_end && (
            <div style={{ fontSize: 12, color: c.tm, marginTop: 4 }}>
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
          <h2 style={{ fontSize: 15, fontWeight: 600, color: c.tx, marginBottom: 14 }}>
            {isTrial ? "Choose a plan before your trial ends" : "Choose a plan to continue"}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* Monthly */}
            <Card style={{ textAlign: "center", padding: "28px 24px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
                Monthly
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: c.tx, fontFamily: MONO, marginBottom: 4 }}>
                £3.99
              </div>
              <div style={{ fontSize: 12, color: c.td, marginBottom: 20 }}>per month</div>
              <Btn onClick={() => handleCheckout("monthly")} dis={loading} style={{ width: "100%", justifyContent: "center" }}>
                {loading ? "Loading..." : "Subscribe Monthly"}
              </Btn>
            </Card>

            {/* Annual */}
            <Card style={{ textAlign: "center", padding: "28px 24px", borderColor: c.ac, position: "relative" }}>
              <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: c.ac, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 12px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Best Value
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
                Annual
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: c.tx, fontFamily: MONO, marginBottom: 4 }}>
                £34.99
              </div>
              <div style={{ fontSize: 12, color: c.td, marginBottom: 8 }}>per year (save 27%)</div>
              <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 20, fontStyle: "italic" }}>One late payment fee covers your entire year. Everything else is profit.</div>
              <Btn onClick={() => handleCheckout("annual")} dis={loading} style={{ width: "100%", justifyContent: "center" }}>
                {loading ? "Loading..." : "Subscribe Annually"}
              </Btn>
            </Card>
          </div>
        </>
      )}

      {/* Features list */}
      <Card>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 14px" }}>
          What's included in Hielda Pro
        </h3>
        {[
          "Hielda chases on your behalf — you stay the good guy",
          "19-stage escalation from friendly reminder to final notice",
          "Statutory interest & penalty calculations (UK Late Payment Act 1998)",
          "Automatic chase emails at every stage",
          "Check-in before every step — you stay in full control",
          "PDF invoice generation & download",
          "Chase timeline & audit trail",
          "Priority email support",
        ].map((feature) => (
          <div key={feature} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13, color: c.tx }}>
            <span style={{ color: c.gn, fontWeight: 700 }}>✓</span>
            {feature}
          </div>
        ))}
      </Card>

      <div style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: c.td }}>
        <a href="mailto:support@hielda.com" style={{ color: c.td }}>support@hielda.com</a>
        {" · "}
        <a href="/privacy" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("hielda:show-privacy")) }} style={{ color: c.td }}>Privacy Policy</a>
      </div>
    </div>
  )
}
