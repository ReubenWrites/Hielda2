import { useState, useEffect, useRef } from "react"
import { supabase } from "../supabase"
import { TERMS, getBoe, getRate, onRateChange } from "../constants"
import { Card, Inp, Sel, Btn, ErrorBanner, CollapsibleSection } from "./ui"
import s from "./Settings.module.css"

export default function Settings({ profile, onUpdate, isMobile }) {
  const [p, setP] = useState(profile || {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef(null)

  const [rateInfo, setRateInfo] = useState({ boe: getBoe(), rate: getRate() })

  useEffect(() => {
    if (profile) setP(profile)
  }, [profile])

  useEffect(() => onRateChange(({ boe, rate }) => setRateInfo({ boe, rate })), [])

  // Validation checks
  const sortCodeDigits = (p.sort_code || "").replace(/[^0-9]/g, "")
  const sortCodeError = p.sort_code && sortCodeDigits.length !== 6
  const acctNumError = p.account_number && p.account_number.length !== 8
  const swiftError = p.swift_bic && (p.swift_bic.length < 8 || p.swift_bic.length > 11)
  const ibanError = p.iban && (p.iban.length < 15 || p.iban.length > 34)
  const hasValidationErrors = sortCodeError || acctNumError || swiftError || ibanError

  const save = async () => {
    if (hasValidationErrors) {
      setError("Please fix the validation errors before saving.")
      return
    }
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
          company_reg_number: p.company_reg_number,
          vat_registered: p.vat_registered || false,
          default_vat_rate: p.default_vat_rate || "20",
          invoice_prefix: p.invoice_prefix || "INV",
          next_invoice_number: p.next_invoice_number || 1,
          default_payment_terms: p.default_payment_terms ? parseInt(p.default_payment_terms) : 30,
          swift_bic: p.swift_bic || null,
          iban: p.iban || null,
          logo_url: p.logo_url || null,
          invoice_signoff: p.invoice_signoff || null,
          website_url: p.website_url || null,
          payment_terms_note: p.payment_terms_note || null,
          chase_tone: p.chase_tone || "firm",
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

  const uploadLogo = async (file) => {
    if (!file || !p.id) return
    const ext = file.name.split(".").pop().toLowerCase()
    if (!["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
      setError("Logo must be a PNG, JPG, GIF, WebP, or SVG file.")
      return
    }
    setLogoUploading(true)
    setError("")
    try {
      const path = `${p.id}/logo.${ext}`
      const { error: upErr } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw new Error(upErr.message)
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path)
      update("logo_url", urlData.publicUrl)
    } catch (e) {
      setError("Logo upload failed: " + e.message + ". Make sure the 'logos' storage bucket exists in Supabase with public access.")
    }
    setLogoUploading(false)
  }

  const removeLogo = async () => {
    if (!p.id || !p.logo_url) return
    const path = p.logo_url.split("/logos/").pop()
    await supabase.storage.from("logos").remove([path])
    update("logo_url", null)
  }

  return (
    <div>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Your Details</h1>
          <p className={s.subtitle}>Auto-fills every invoice.</p>
        </div>
        <Btn onClick={save} dis={saving || hasValidationErrors}>
          {saving ? "Saving..." : saved ? "\u2713 Saved!" : hasValidationErrors ? "Fix errors" : "Save Changes"}
        </Btn>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div className={s.grid}>
        <Card>
          <h3 className={s.sectionHeading}>Personal</h3>
          <Inp label="Name" value={p.full_name || ""} onChange={(v) => update("full_name", v)} />
          <Inp label="Business" value={p.business_name || ""} onChange={(v) => update("business_name", v)} />
          <Inp label="Email" value={p.email || ""} onChange={() => {}} disabled />

          <Inp label="Address" value={p.address || ""} onChange={(v) => update("address", v)} ta />
        </Card>
        <Card>
          <h3 className={s.sectionHeading}>Payment</h3>
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
          <div className={s.vatCheckbox}>
            <label className={s.vatLabel}>
              <input
                type="checkbox"
                checked={p.vat_registered || false}
                onChange={(e) => update("vat_registered", e.target.checked)}
                className={s.vatCheckInput}
              />
              VAT Registered
            </label>
            <p className={s.hintIndented}>Enable to add VAT to invoices.</p>
          </div>
          {p.vat_registered && (
            <>
              <Inp label="VAT Number" value={p.vat_number || ""} onChange={(v) => update("vat_number", v)} mono />
              <Sel
                label="Default VAT Rate"
                value={p.default_vat_rate || "20"}
                onChange={(v) => update("default_vat_rate", v)}
                opts={[
                  { l: "20% Standard", v: "20" },
                  { l: "5% Reduced", v: "5" },
                  { l: "0% Zero-rated", v: "0" },
                  { l: "Exempt", v: "exempt" },
                ]}
              />
            </>
          )}
          <Inp label="Company Reg No. (optional)" value={p.company_reg_number || ""} onChange={(v) => update("company_reg_number", v)} mono ph="e.g. 12345678" />
          <Inp label="UTR (optional)" value={p.utr_number || ""} onChange={(v) => update("utr_number", v)} mono />
          <p className={s.hint}>Unique Taxpayer Reference — your 10-digit HMRC number for self-assessment.</p>
          <div className={s.rateBox}>
            <div className={s.rateTitle}>Statutory Rates</div>
            <div className={s.rateBody}>
              BoE: {rateInfo.boe}% &middot; Interest: {rateInfo.rate}% p.a.<br />
              Penalties: &pound;40 / &pound;70 / &pound;100
            </div>
          </div>
        </Card>
      </div>

      <div className={s.gridMt}>
        {/* International banking */}
        <CollapsibleSection title="International Banking" description="For overseas clients. Shown on invoices alongside your UK sort code and account number.">
          <Inp label="SWIFT / BIC" value={p.swift_bic || ""} onChange={(v) => update("swift_bic", v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))} mono ph="e.g. HBUKGB4B"
            error={p.swift_bic && (p.swift_bic.length < 8 || p.swift_bic.length > 11) ? "Must be 8 or 11 characters" : ""} />
          <Inp label="IBAN" value={p.iban || ""} onChange={(v) => update("iban", v.toUpperCase().replace(/\s/g, "").slice(0, 34))} mono ph="e.g. GB29NWBK60161331926819"
            error={p.iban && (p.iban.length < 15 || p.iban.length > 34) ? "Must be 15-34 characters" : ""} />
        </CollapsibleSection>

        {/* Branding */}
        <CollapsibleSection title="Invoice Branding" description="Your logo and website shown on invoices.">
          <Inp
            label="Website (optional)"
            value={p.website_url || ""}
            onChange={(v) => {
              const trimmed = v.trim()
              if (trimmed && !trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
                update("website_url", "https://" + trimmed)
              } else {
                update("website_url", trimmed)
              }
            }}
            ph="https://yoursite.com"
          />

          {/* Logo upload */}
          <div className={s.logoWrap}>
            <label className={s.logoLabel}>
              Company Logo
            </label>
            {p.logo_url ? (
              <div className={s.logoPreview}>
                <img src={p.logo_url} alt="Logo" className={s.logoImg} />
                <button onClick={removeLogo} className={s.removeBtn}>
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className={s.uploadBtn}
                >
                  {logoUploading ? "Uploading..." : "Upload logo (PNG, JPG, SVG)"}
                </button>
                <p className={s.hintSmall}>
                  Recommended: PNG with transparent background, min 200px wide.
                </p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      <div className={s.section}>
        <CollapsibleSection title="Invoice Personalisation" description="Custom signoff and payment terms shown on your invoices.">
          <div className={s.personalisationGrid}>
            <div>
              <Inp
                label="Custom signoff (optional)"
                value={p.invoice_signoff || ""}
                onChange={(v) => update("invoice_signoff", v.slice(0, 200))}
                ta
                ph="e.g. Thank you for your business — we look forward to working with you again."
              />
              <p className={s.hintBelow}>Printed at the bottom of every invoice.</p>
            </div>
            <div>
              <Inp
                label="Payment terms note (optional)"
                value={p.payment_terms_note || ""}
                onChange={(v) => update("payment_terms_note", v.slice(0, 500))}
                ta
                ph="e.g. Payment is due within 30 days of invoice date. Late payments are subject to statutory interest under the Late Payment of Commercial Debts Act 1998."
              />
              <p className={s.hintBelow}>Included in your first invoice email to every client.</p>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      <div className={s.section}>
        <Card>
          <h3 className={s.sectionHeading}>Chase Email Tone</h3>
          <p className={s.toneDesc}>Controls the language and formality of chase emails sent to your clients.</p>
          <div className={s.toneOptions}>
            {[
              { value: "friendly", label: "Friendly", desc: "Softer, relationship-focused language. Good for clients you work with regularly." },
              { value: "firm", label: "Firm", desc: "Direct and professional. The standard Hielda tone." },
              { value: "legal", label: "Legal", desc: "Formal, cites legislation explicitly. Best for difficult or corporate clients." },
            ].map((t) => (
              <label key={t.value} className={`${s.toneOption} ${(p.chase_tone || "firm") === t.value ? s.toneOptionActive : ""}`}>
                <input
                  type="radio"
                  name="chase_tone"
                  value={t.value}
                  checked={(p.chase_tone || "firm") === t.value}
                  onChange={() => update("chase_tone", t.value)}
                  className={s.toneRadio}
                />
                <div>
                  <div className={s.toneLabel}>{t.label}</div>
                  <div className={s.toneHint}>{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Card>
      </div>

      <div className={s.section}>
        <Card>
          <h3 className={s.sectionHeading}>Invoice Defaults</h3>
          <div className={s.defaultsGrid}>
            <Inp label="Invoice Prefix" value={p.invoice_prefix || "INV"} onChange={(v) => update("invoice_prefix", v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10))} ph="INV" mono />
            <Inp label="Next Invoice Number" value={String(p.next_invoice_number || 1)} onChange={(v) => update("next_invoice_number", parseInt(v.replace(/[^0-9]/g, "")) || 1)} ph="1" mono />
          </div>
          <p className={s.nextInvoice}>
            Your next invoice will be: <strong className={s.nextInvoiceCode}>{(p.invoice_prefix || "INV")}-{String(p.next_invoice_number || 1).padStart(4, "0")}</strong>
          </p>
          <div className={s.termsWrap}>
            <Sel
              label="Default Payment Terms"
              value={String(p.default_payment_terms || 30)}
              onChange={(v) => update("default_payment_terms", parseInt(v))}
              opts={TERMS.filter(t => t.d !== -1).map((t) => ({ l: t.l, v: String(t.d) }))}
            />
          </div>
          <p className={s.termsHint}>
            New invoices will default to this payment term. You can override it per invoice.
          </p>
        </Card>
      </div>
    </div>
  )
}
