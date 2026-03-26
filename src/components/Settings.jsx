import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import { colors as c, BOE, RATE } from "../constants"
import { Card, Inp, Btn, ErrorBanner } from "./ui"

export default function Settings({ profile, onUpdate, isMobile }) {
  const [p, setP] = useState(profile || {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (profile) setP(profile)
  }, [profile])

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          full_name: p.full_name,
          business_name: p.business_name,
          phone: p.phone,
          address: p.address,
          bank_name: p.bank_name,
          sort_code: p.sort_code,
          account_number: p.account_number,
          vat_number: p.vat_number,
          utr_number: p.utr_number,
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
          <Inp label="Phone" value={p.phone || ""} onChange={(v) => update("phone", v)} />
          <Inp label="Address" value={p.address || ""} onChange={(v) => update("address", v)} ta />
        </Card>
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: "0 0 14px" }}>Payment</h3>
          <Inp label="Bank" value={p.bank_name || ""} onChange={(v) => update("bank_name", v)} />
          <Inp label="Sort Code" value={p.sort_code || ""} onChange={(v) => update("sort_code", v)} mono />
          <Inp label="Account No." value={p.account_number || ""} onChange={(v) => update("account_number", v)} mono />
          <Inp label="VAT (optional)" value={p.vat_number || ""} onChange={(v) => update("vat_number", v)} mono />
          <Inp label="UTR (optional)" value={p.utr_number || ""} onChange={(v) => update("utr_number", v)} mono />
          <div style={{ marginTop: 14, padding: 12, background: c.acd, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: c.ac, fontWeight: 600, marginBottom: 3 }}>Statutory Rates</div>
            <div style={{ fontSize: 11, color: c.tm, lineHeight: 1.5 }}>
              BoE: {BOE}% · Interest: {RATE}% p.a.<br />
              Penalties: £40 / £70 / £100
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
