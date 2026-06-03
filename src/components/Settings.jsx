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

    // MIME type is more reliable than file extension — Android content URIs
    // and some camera roll exports don't carry an extension at all. Use the
    // MIME type as the authoritative source, fall back to extension only as
    // a last resort.
    const mime = (file.type || "").toLowerCase()
    const extFromName = file.name?.split(".").pop()?.toLowerCase() || ""

    // SVG silently fails in the PDF generator (jsPDF can't render SVG via
    // addImage), so we'd be accepting a logo that never appears on actual
    // invoices. Explicitly reject upfront with a useful message rather
    // than letting the user discover the problem at PDF time.
    if (mime === "image/svg+xml" || extFromName === "svg") {
      setError("SVG logos aren't supported on invoices (PDFs can't render them). Please upload a PNG or JPG instead.")
      return
    }

    // HEIC is the default iPhone camera format. Reject with guidance —
    // jsPDF can't render HEIC and converting in-browser needs a heavy
    // dependency we'd rather not ship. iOS Photos can re-export as JPG.
    if (mime === "image/heic" || mime === "image/heif" || extFromName === "heic" || extFromName === "heif") {
      setError("iPhone HEIC photos aren't supported. In iOS Photos, tap Edit → Done to convert, or take a screenshot of the logo and upload that instead.")
      return
    }

    // 5MB is the Supabase storage default cap and well past anything a
    // PDF logo actually needs (the PDF resizes to a 50×20mm bounding box).
    const MAX_BYTES = 5 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      setError(`Logo is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB — try a smaller export or screenshot.`)
      return
    }

    const supportedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"]
    const supportedExts = ["png", "jpg", "jpeg", "gif", "webp"]
    const looksSupported = supportedTypes.includes(mime) || supportedExts.includes(extFromName)
    if (!looksSupported) {
      setError(`That file type isn't supported (${mime || extFromName || "unknown"}). Please upload a PNG, JPG, GIF, or WebP.`)
      return
    }

    setLogoUploading(true)
    setError("")
    try {
      // Pick the extension from the MIME type so an extension-less Android
      // file ends up with a sensible name in storage.
      const ext = mime === "image/png" ? "png"
        : mime === "image/jpeg" ? "jpg"
        : mime === "image/gif" ? "gif"
        : mime === "image/webp" ? "webp"
        : (supportedExts.includes(extFromName) ? extFromName : "png")
      const path = `${p.id}/logo.${ext}`
      const { error: upErr } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true, contentType: file.type || `image/${ext}` })
      if (upErr) throw new Error(upErr.message)
      // Cache-bust so the new logo replaces the old one in the preview
      // immediately — Supabase's public URL would otherwise serve the
      // cached old version because the path is the same.
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path)
      update("logo_url", `${urlData.publicUrl}?v=${Date.now()}`)
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--tm)", background: "var(--acd)", border: "1px solid var(--bdl)", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
            <span aria-hidden="true">🔒</span>
            <span>Your bank details are encrypted at rest. Only you and your clients (on their invoices) ever see them.</span>
          </div>
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
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              style={{ display: "none" }}
            />
            {p.logo_url ? (
              <div className={s.logoPreview}>
                <img src={p.logo_url} alt="Logo" className={s.logoImg} />
                <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading} className={s.uploadBtn}>
                  {logoUploading ? "Uploading..." : "Replace"}
                </button>
                <button onClick={removeLogo} className={s.removeBtn}>
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className={s.uploadBtn}
                >
                  {logoUploading ? "Uploading..." : "Upload logo"}
                </button>
                <p className={s.hintSmall}>
                  PNG, JPG, GIF or WebP. Up to 5MB. Recommended: PNG with transparent background, at least 200px wide. iPhone HEIC photos need converting to JPG first.
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
          <CollapsibleSection title="Chase Email Tone" description="Controls the language and formality of chase emails sent to your clients.">
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
          </CollapsibleSection>
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

      {/* Mobile sticky-bottom Save bar. Hidden on desktop where the
          header Save button is always visible up top. */}
      {isMobile && (
        <div className={s.mobileSaveBar}>
          <Btn onClick={save} dis={saving || hasValidationErrors} sz="lg">
            {saving ? "Saving..." : saved ? "✓ Saved!" : hasValidationErrors ? "Fix errors first" : "Save changes"}
          </Btn>
        </div>
      )}
    </div>
  )
}
