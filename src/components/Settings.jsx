import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import { colors as c, TERMS, getBoe, getRate, onRateChange } from "../constants"
import { Card, Inp, Sel, Btn, ErrorBanner } from "./ui"

export default function Settings({ profile, onUpdate, isMobile }) {
  const [p, setP] = useState(profile || {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const [rateInfo, setRateInfo] = useState({ boe: getBoe(), rate: getRate() })

  useEffect(() => {
    if (profile) setP(profile)
  }, [profile])

  useEffect(() => onRateChange(({ boe, rate }) => setRateInfo({ boe, rate })), [])

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          full_name: p.full_name,
          business_name: p.business_name,

          address: p.address,
          account_name: p.account_name,
          bank_name: p.bank_name,
          sort_code: p.sort_code,
          account_number: p.account_number,
          vat_number: p.vat_number,
          utr_number: p.utr_number,
          default_payment_terms: p.default_payment_terms ? parseInt(p.default_payment_terms) : 30,
        })
        .eq("id", p.id)
      if (dbError) throw dbError
      onUpdate()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError("Failed to save: " + e.message)
    }
    setSaving(false)
  }

  const update = (field, value) => setP((prev) => ({ ...prev, [field]: value }))

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: c.tx, margin: "0 0 5px" }}>Your Details</h1>
          <p style={{ color: c.tm, margin: 0, fontSize: 13 }}>Auto-fills every invoice.</p>
        </div>
        <Btn onClick={save} dis={saving}>
          {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Changes"}
        </Btn>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: "0 0 14px" }}>Personal</h3>
          <Inp label="Name" value={p.full_name || ""} onChange={(v) => update("full_name", v)} />
          <Inp label="Business" value={p.business_name || ""} onChange={(v) => update("business_name", v)} />
          <Inp label="Email" value={p.email || ""} onChange={() => {}} disabled />

          <Inp label="Address" value={p.address || ""} onChange={(v) => update("address", v)} ta />
        </Card>
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: "0 0 14px" }}>Payment</h3>
          <Inp label="Account Name" value={p.account_name || ""} onChange={(v) => update("account_name", v)} />
          <Inp label="Bank" value={p.bank_name || ""} onChange={(v) => update("bank_name", v)} />
          <Inp
            label="Sort Code"
            value={p.sort_code || ""}
            onChange={(v) => {
              const digits = v.replace(/[^0-9]/g, "").slice(0, 6)
              const formatted = digits.length > 4 ? `${digits.slice(0,2)}-${digits.slice(2,4)}-${digits.slice(4)}` : digits.length > 2 ? `${digits.slice(0,2)}-${digits.slice(2)}` : digits
              update("sort_code", formatted)
            }}
            ph="00-00-00"
            mono
            error={p.sort_code && p.sort_code.replace(/[^0-9]/g, "").length !== 6 ? "Must be 6 digits (e.g. 20-30-40)" : ""}
          />
          <Inp
            label="Account No."
            value={p.account_number || ""}
            onChange={(v) => update("account_number", v.replace(/[^0-9]/g, "").slice(0, 8))}
            ph="12345678"
            mono
            error={p.account_number && p.account_number.length !== 8 ? "Must be 8 digits" : ""}
          />
          <Inp label="VAT (optional)" value={p.vat_number || ""} onChange={(v) => update("vat_number", v)} mono />
          <Inp label="UTR (optional)" value={p.utr_number || ""} onChange={(v) => update("utr_number", v)} mono />
          <p style={{ fontSize: 10, color: c.td, margin: "-6px 0 4px" }}>Unique Taxpayer Reference — your 10-digit HMRC number for self-assessment.</p>
          <div style={{ marginTop: 14, padding: 12, background: c.acd, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: c.ac, fontWeight: 600, marginBottom: 3 }}>Statutory Rates</div>
            <div style={{ fontSize: 11, color: c.tm, lineHeight: 1.5 }}>
              BoE: {rateInfo.boe}% · Interest: {rateInfo.rate}% p.a.<br />
              Penalties: £40 / £70 / £100
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: "0 0 14px" }}>Invoice Defaults</h3>
          <div style={{ maxWidth: 320 }}>
            <Sel
              label="Default Payment Terms"
              value={String(p.default_payment_terms || 30)}
              onChange={(v) => update("default_payment_terms", parseInt(v))}
              opts={TERMS.filter(t => t.d !== -1).map((t) => ({ l: t.l, v: String(t.d) }))}
            />
          </div>
          <p style={{ fontSize: 11, color: c.td, margin: "4px 0 0" }}>
            New invoices will default to this payment term. You can override it per invoice.
          </p>
        </Card>
      </div>
    </div>
  )
}
