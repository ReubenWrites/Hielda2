import { useState } from "react"
import { supabase } from "../supabase"
import { Card, Inp, Btn, ShieldLogo, ErrorBanner } from "./ui"
import s from "./Onboarding.module.css"

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

      const { error: subError } = await supabase
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          status: "trialing",
          plan: "pro",
        }, { onConflict: "user_id" })

      if (subError) console.warn("Subscription setup warning:", subError.message)

      onComplete()
    } catch (e) {
      setError("Failed to save your details: " + e.message)
    }
    setSaving(false)
  }

  return (
    <div className={s.wrapper}>
      <div className={s.patternOverlay} />

      <Card style={{ width: "100%", maxWidth: 520, padding: 0, position: "relative", zIndex: 1, margin: "0 16px" }}>
        <div className={s.cardInner}>
          {/* Progress indicator */}
          <div className={s.progressBar}>
            {STEPS.map((label, i) => (
              <div key={label} className={s.progressItem}>
                <div className={`${s.progressTrack} ${i <= step ? s.progressTrackActive : s.progressTrackInactive}`} />
                <span className={`${s.progressLabel} ${i <= step ? s.progressLabelActive : s.progressLabelInactive}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <ErrorBanner message={error} onDismiss={() => setError("")} />

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className={s.welcomeCenter}>
              <ShieldLogo size={48} />
              <h1 className={s.welcomeTitle}>
                Welcome to Hielda
              </h1>
              <p className={s.welcomeDesc}>
                Hielda automatically chases late invoices and calculates the interest and penalties you're legally owed under UK law.
              </p>

              <div className={s.featureList}>
                {[
                  { icon: "📋", title: "Create invoices", desc: "Add your invoices and we'll track payment deadlines." },
                  { icon: "🛡️", title: "Automatic chasing", desc: "We send escalating chase emails when payments are late." },
                  { icon: "💰", title: "Legal enforcement", desc: "We calculate statutory interest and penalties owed to you." },
                ].map((item) => (
                  <div key={item.title} className={s.featureItem}>
                    <div className={s.featureIcon}>{item.icon}</div>
                    <div>
                      <div className={s.featureTitle}>{item.title}</div>
                      <div className={s.featureDesc}>{item.desc}</div>
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
              <h2 className={s.stepTitle}>Your Business</h2>
              <p className={s.stepDesc}>
                Just your business name to get started. You can add payment and other details later.
              </p>
              <div className={s.securityNotice}>
                <span className={s.securityIcon}>🔒</span>
                <p className={s.securityText}>
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

              <div className={s.stepActions}>
                <Btn v="ghost" onClick={() => setStep(0)}>← Back</Btn>
                <Btn dis={!step1Valid || saving} onClick={handleComplete}>
                  {saving ? "Setting up..." : "Let's go →"}
                </Btn>
              </div>
              <p className={s.trialNote}>
                No card required · 6-week free trial
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
