import { useState } from "react"
import { supabase } from "../supabase"
import { colors as c, FONT } from "../constants"
import { Card, Inp, Btn, ShieldLogo, ErrorBanner, Spinner } from "./ui"

const STEPS = ["Welcome", "Business Details", "Payment Details"]

export default function Onboarding({ user, profile, onComplete }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    full_name: profile?.full_name || user?.user_metadata?.full_name || "",
    business_name: profile?.business_name || "",
    phone: profile?.phone || "",
    address: profile?.address || "",
    bank_name: profile?.bank_name || "",
    sort_code: profile?.sort_code || "",
    account_number: profile?.account_number || "",
    vat_number: profile?.vat_number || "",
    utr_number: profile?.utr_number || "",
  })

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  // Validation
  const sortCodeClean = form.sort_code.replace(/[^0-9]/g, "")
  const acctClean = form.account_number.replace(/[^0-9]/g, "")

  const step1Valid = form.business_name.trim().length > 0
  const step2Valid =
    form.bank_name.trim().length > 0 &&
    sortCodeClean.length === 6 &&
    acctClean.length === 8

  const sortCodeError =
    form.sort_code && sortCodeClean.length !== 6 ? "Must be 6 digits (e.g. 12-34-56)" : ""
  const acctError =
    form.account_number && acctClean.length !== 8 ? "Must be 8 digits" : ""

  const handleComplete = async () => {
    setSaving(true)
    setError("")
    try {
      const profileData = {
        id: user.id,
        email: user.email,
        full_name: form.full_name,
        business_name: form.business_name,
        phone: form.phone,
        address: form.address,
        bank_name: form.bank_name,
        sort_code: form.sort_code,
        account_number: form.account_number,
        vat_number: form.vat_number,
        utr_number: form.utr_number,
        onboarding_complete: true,
      }

      const { error: profError } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: "id" })

      if (profError) throw profError

      // Create trial subscription
      const { error: subError } = await supabase
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          status: "trialing",
          plan: "pro",
          trial_start: new Date().toISOString(),
          trial_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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

      <Card style={{ width: 520, padding: "40px 36px", position: "relative", zIndex: 1 }}>
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
            <p style={{ color: c.tm, fontSize: 13, marginBottom: 22 }}>
              These details auto-fill every invoice you create.
            </p>

            <Inp label="Full Name" value={form.full_name} onChange={(v) => update("full_name", v)} ph="Your name" />
            <Inp
              label="Business Name *"
              value={form.business_name}
              onChange={(v) => update("business_name", v)}
              ph="e.g. Smith Design Ltd"
              error={form.business_name !== undefined && form.business_name.length === 0 ? "" : ""}
            />
            <Inp label="Phone" value={form.phone} onChange={(v) => update("phone", v)} ph="07xxx xxx xxx" />
            <Inp label="Business Address" value={form.address} onChange={(v) => update("address", v)} ph="Your business address" ta />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <Btn v="ghost" onClick={() => setStep(0)}>← Back</Btn>
              <Btn dis={!step1Valid} onClick={() => setStep(2)}>Next →</Btn>
            </div>
          </div>
        )}

        {/* Step 2: Payment Details */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: c.tx, margin: "0 0 4px" }}>Payment Details</h2>
            <p style={{ color: c.tm, fontSize: 13, marginBottom: 22 }}>
              Shown on your invoices so clients can pay you directly.
            </p>

            <Inp label="Bank Name *" value={form.bank_name} onChange={(v) => update("bank_name", v)} ph="e.g. Barclays" />
            <Inp
              label="Sort Code *"
              value={form.sort_code}
              onChange={(v) => update("sort_code", v)}
              ph="12-34-56"
              mono
              error={sortCodeError}
            />
            <Inp
              label="Account Number *"
              value={form.account_number}
              onChange={(v) => update("account_number", v)}
              ph="12345678"
              mono
              error={acctError}
            />
            <Inp label="VAT Number (optional)" value={form.vat_number} onChange={(v) => update("vat_number", v)} ph="GB 123 4567 89" mono />
            <Inp label="UTR Number (optional)" value={form.utr_number} onChange={(v) => update("utr_number", v)} ph="12345 67890" mono />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <Btn v="ghost" onClick={() => setStep(1)}>← Back</Btn>
              <Btn dis={!step2Valid || saving} onClick={handleComplete}>
                {saving ? "Setting up..." : "Complete Setup →"}
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
