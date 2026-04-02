import { useState } from "react"
import { supabase } from "../supabase"
import { colors as c, FONT } from "../constants"
import { Card, Inp, Btn, ShieldLogo, ErrorBanner } from "./ui"

const STEPS = ["Welcome", "Your Business"]

export default function Onboarding({ user, profile, onComplete }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [touched, setTouched] = useState({})

  const [form, setForm] = useState({
    full_name: profile?.full_name || user?.user_metadata?.full_name || "",
    business_name: profile?.business_name || "",
  })

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))
  const blur = (field) => setTouched((prev) => ({ ...prev, [field]: true }))

  const step1Valid = form.business_name.trim().length > 0

  const businessNameError =
    touched.business_name && form.business_name.trim().length === 0 ? "Business name is required" : ""

  const handleComplete = async () => {
    setSaving(true)
    setError("")
    try {
      const profileData = {
        id: user.id,
        email: user.email,
        full_name: form.full_name,
        business_name: form.business_name,
        onboarding_complete: true,
      }

      // Retry upsert up to 3 times — the auth token may not be fully
      // propagated for RLS checks immediately after email verification
      let profError
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await supabase
          .from("profiles")
          .upsert(profileData, { onConflict: "id" })
        profError = res.error
        if (!profError) break
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000))
      }

      if (profError) throw profError

      // Create trial subscription (dates default via DB: trial_start=now(), trial_end=now()+7days)
      const { error: subError } = await supabase
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          status: "trialing",
          plan: "pro",
        }, { onConflict: "user_id" })

      // Don't fail onboarding if subscription insert fails (table might not exist yet)
      if (subError) console.warn("Subscription setup warning:", subError.message)

      onComplete()
    } catch (e) {
      setError("Failed to save your details: " + e.message)
    }
    setSaving(false)
  }

  return (
    <div style={{ fontFamily: FONT, background: c.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.25, backgroundImage: "radial-gradient(circle,#b0bcc8 0.5px,transparent 0.5px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />

      <Card style={{ width: "100%", maxWidth: 520, padding: window.innerWidth <= 768 ? "28px 20px" : "40px 36px", position: "relative", zIndex: 1, margin: "0 16px" }}>
        {/* Progress indicator */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ flex: 1 }}>
              <div style={{ height: 3, borderRadius: 2, background: i <= step ? c.ac : c.bd, marginBottom: 6, transition: "background 0.3s" }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: i <= step ? c.ac : c.td, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <ErrorBanner message={error} onDismiss={() => setError("")} />

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            <ShieldLogo size={48} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: c.ac, margin: "16px 0 6px", letterSpacing: "-0.02em" }}>
              Welcome to Hielda
            </h1>
            <p style={{ color: c.tm, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Hielda automatically chases late invoices and calculates the interest and penalties you're legally owed under UK law.
            </p>

            <div style={{ textAlign: "left", marginBottom: 28 }}>
              {[
                { icon: "📋", title: "Create invoices", desc: "Add your invoices and we'll track payment deadlines." },
                { icon: "🛡️", title: "Automatic chasing", desc: "We send escalating chase emails when payments are late." },
                { icon: "💰", title: "Legal enforcement", desc: "We calculate statutory interest and penalties owed to you." },
              ].map((item) => (
                <div key={item.title} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: `1px solid ${c.bdl}` }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600, color: c.tx, fontSize: 13, marginBottom: 2 }}>{item.title}</div>
                    <div style={{ color: c.tm, fontSize: 12 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <Btn onClick={() => setStep(1)} style={{ width: "100%", justifyContent: "center" }} sz="lg">
              Get Started
            </Btn>
          </div>
        )}

        {/* Step 1: Business Details */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: c.tx, margin: "0 0 4px" }}>Your Business</h2>
            <p style={{ color: c.tm, fontSize: 13, marginBottom: 16 }}>
              Just your business name to get started. You can add payment and other details later.
            </p>
            <div style={{ background: "#f0f6ff", border: `1px solid ${c.bdl}`, borderRadius: 8, padding: "10px 14px", marginBottom: 22, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>🔒</span>
              <p style={{ color: c.tm, fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>
                Your information is stored securely and only used to send invoices and chase emails. We never share your data with third parties.
              </p>
            </div>

            <Inp label="Full Name" value={form.full_name} onChange={(v) => update("full_name", v)} ph="Your name" />
            <Inp
              label="Business Name *"
              value={form.business_name}
              onChange={(v) => update("business_name", v)}
              onBlur={() => blur("business_name")}
              ph="e.g. Smith Design Ltd"
              error={businessNameError}
            />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <Btn v="ghost" onClick={() => setStep(0)}>← Back</Btn>
              <Btn dis={!step1Valid || saving} onClick={handleComplete}>
                {saving ? "Setting up..." : "Let's go →"}
              </Btn>
            </div>
            <p style={{ textAlign: "center", color: c.td, fontSize: 10.5, marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
              No card required · 6-week free trial
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
