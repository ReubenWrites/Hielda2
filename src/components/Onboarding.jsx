import { useState } from "react"
import { supabase } from "../supabase"
import { trackEvent } from "../posthog"
import { Card, Inp, Btn, ShieldLogo, ErrorBanner } from "./ui"
import s from "./Onboarding.module.css"

const STEPS = ["Welcome", "Your Business", "Getting Paid"]

export default function Onboarding({ user, profile, onComplete }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [touched, setTouched] = useState({})

  const [form, setForm] = useState({
    full_name: profile?.full_name || user?.user_metadata?.full_name || "",
    business_name: profile?.business_name || "",
    account_name: profile?.account_name || "",
    sort_code: profile?.sort_code || "",
    account_number: profile?.account_number || "",
  })

  // Bank details are needed before the first invoice can be created (they
  // go on the PDF so the client knows where to pay). Every new user used to
  // finish onboarding, click "Create your first invoice" and hit a
  // "Payment details needed" wall. Ask here instead - optional, skippable.
  const bankValid = (() => {
    const sc = form.sort_code.replace(/\D/g, "")
    const an = form.account_number.replace(/\D/g, "")
    const anyFilled = form.account_name.trim() || sc || an
    if (!anyFilled) return true
    return sc.length === 6 && an.length === 8 && form.account_name.trim().length > 0
  })()

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))
  const blur = (field) => setTouched((prev) => ({ ...prev, [field]: true }))

  const step1Valid = form.business_name.trim().length > 0

  const businessNameError =
    touched.business_name && form.business_name.trim().length === 0 ? "Business name is required" : ""

  const handleComplete = async () => {
    setSaving(true)
    setError("")
    try {
      const sc = form.sort_code.replace(/\D/g, "")
      const profileData = {
        id: user.id,
        email: user.email,
        full_name: form.full_name,
        business_name: form.business_name,
        onboarding_complete: true,
        ...(form.account_name.trim() ? { account_name: form.account_name.trim() } : {}),
        ...(sc.length === 6 ? { sort_code: `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4)}` } : {}),
        ...(form.account_number.replace(/\D/g, "").length === 8 ? { account_number: form.account_number.replace(/\D/g, "") } : {}),
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

      trackEvent("onboarding_completed", { business_name: form.business_name })

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

              <Btn onClick={() => { trackEvent("onboarding_started"); setStep(1) }} style={{ width: "100%", justifyContent: "center" }} sz="lg">
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
                <Btn dis={!step1Valid} onClick={() => setStep(2)}>
                  Next →
                </Btn>
              </div>
              <p className={s.trialNote}>
                No card required · 6-week free trial
              </p>
            </div>
          )}

          {/* Step 2: Bank details — where clients should pay. Optional. */}
          {step === 2 && (
            <div>
              <h2 className={s.stepTitle}>Where should clients pay you?</h2>
              <p className={s.stepDesc}>
                These go on every invoice and chase email so your client always knows where to send the money. You can add or change them later in Your Details.
              </p>
              <div className={s.securityNotice}>
                <span className={s.securityIcon}>🔒</span>
                <p className={s.securityText}>
                  Encrypted at rest. Only you and your clients (on their invoices) ever see them.
                </p>
              </div>

              <Inp label="Account Name" value={form.account_name} onChange={(v) => update("account_name", v)} ph={form.business_name || "Your business name"} />
              <Inp label="Sort Code" value={form.sort_code} onChange={(v) => update("sort_code", v)} ph="00-00-00" />
              <Inp label="Account Number" value={form.account_number} onChange={(v) => update("account_number", v)} ph="12345678" />
              {!bankValid && (
                <p className={s.stepDesc} style={{ color: "#b91c1c" }}>
                  Enter all three — a 6-digit sort code and an 8-digit account number — or leave them all blank for now.
                </p>
              )}

              <div className={s.stepActions}>
                <Btn v="ghost" onClick={() => setStep(1)}>← Back</Btn>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn v="ghost" dis={saving} onClick={() => { setForm((f) => ({ ...f, account_name: "", sort_code: "", account_number: "" })); handleComplete() }}>
                    Skip for now
                  </Btn>
                  <Btn dis={!bankValid || saving} onClick={handleComplete}>
                    {saving ? "Setting up..." : "Let's go →"}
                  </Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
