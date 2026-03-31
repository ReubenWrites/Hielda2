import { useState, useEffect, useMemo } from "react"
import { supabase } from "../supabase"
import { colors as c, FONT, MONO, TERMS, getRate } from "../constants"
import { penalty, fmt, formatDate, addDays, generateRef, todayStr, isValidEmail, round2 } from "../utils"
import { Card, Inp, Sel, Btn, ErrorBanner } from "./ui"
import { trackEvent } from "../posthog"

const DRAFT_KEY = (userId) => `hielda_draft_${userId}`

export default function Create({ profile, nav, userId, onCreated, isMobile, invs }) {
  const defaultTerms = profile?.default_payment_terms ? String(profile.default_payment_terms) : "30"
  const isCustomDefault = !TERMS.slice(0, -1).some(t => String(t.d) === defaultTerms)

  const [cn, setCn] = useState("")
  const [ce, setCe] = useState("")
  const [ca, setCa] = useState("")
  const defaultVatRate = profile?.vat_registered ? (profile?.default_vat_rate || "20") : "0"
  const [lineItems, setLineItems] = useState([{ description: "", amount: "", vatRate: defaultVatRate }])
  const [terms, setTerms] = useState(isCustomDefault ? "-1" : defaultTerms)
  const [customDays, setCustomDays] = useState(isCustomDefault ? defaultTerms : "")
  const [date, setDate] = useState(todayStr())
  const [step, setStep] = useState(1)
  const [meth, setMeth] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [ref, setRef] = useState(() => {
    const prefix = profile?.invoice_prefix || "INV"
    const num = profile?.next_invoice_number || 1
    return `${prefix}-${String(num).padStart(4, "0")}`
  })
  const [clientType, setClientType] = useState("business")
  const [noFines, setNoFines] = useState(false)
  const [newInvId, setNewInvId] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)
  const [clientRef, setClientRef] = useState("")
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [sendIntro, setSendIntro] = useState(false)
  const [introMethod, setIntroMethod] = useState(null)
  const [introText, setIntroText] = useState("")
  const [introCopied, setIntroCopied] = useState(false)
  const [showIntroInfo, setShowIntroInfo] = useState(false)
  const [showNoFinesInfo, setShowNoFinesInfo] = useState(false)
  const [draftBanner, setDraftBanner] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const [hiddenClients, setHiddenClients] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`hielda_hidden_clients_${userId}`) || "[]") } catch { return [] }
  })

  const hideClient = (email, e) => {
    e.stopPropagation()
    const updated = [...new Set([...hiddenClients, email])]
    setHiddenClients(updated)
    try { localStorage.setItem(`hielda_hidden_clients_${userId}`, JSON.stringify(updated)) } catch {}
  }

  // Deduplicate clients from past invoices (most recent per email), excluding hidden
  const recentClients = useMemo(() => {
    if (!invs?.length) return []
    const seen = new Set()
    return invs
      .filter(i => i.client_email && i.client_name)
      .filter(i => { if (seen.has(i.client_email)) return false; seen.add(i.client_email); return true })
      .filter(i => !hiddenClients.includes(i.client_email))
  }, [invs, hiddenClients])

  // Check for clone data or saved draft on mount
  useEffect(() => {
    if (!userId) return
    try {
      const edit = localStorage.getItem("hielda_edit")
      if (edit) {
        const inv = JSON.parse(edit)
        localStorage.removeItem("hielda_edit")
        setIsEditing(true)
        setEditId(inv.id)
        setCn(inv.client_name || "")
        setCe(inv.client_email || "")
        setCa(inv.client_address || "")
        setClientRef(inv.client_ref || "")
        setCc(inv.cc_emails || "")
        setBcc(inv.bcc_emails || "")
        setRef(inv.ref || "")
        setDate(inv.issue_date || todayStr())
        const termDays = inv.payment_term_days ? String(inv.payment_term_days) : "30"
        const isKnownTerm = TERMS.slice(0, -1).some(t => String(t.d) === termDays)
        setTerms(isKnownTerm ? termDays : "-1")
        if (!isKnownTerm) setCustomDays(termDays)
        if (inv.no_fines) setNoFines(!!(inv.no_fines && inv.client_type !== "consumer"))
        if (inv.client_type) setClientType(inv.client_type)
        if (inv.line_items?.length) {
          setLineItems(inv.line_items.map(li => ({
            description: li.description || "",
            amount: String(li.amount || ""),
            vatRate: li.vatRate || defaultVatRate,
          })))
        } else {
          setLineItems([{ description: inv.description || "", amount: String(inv.amount || ""), vatRate: defaultVatRate }])
        }
        return
      }
    } catch {}
    try {
      const clone = localStorage.getItem("hielda_clone")
      if (clone) {
        const d = JSON.parse(clone)
        localStorage.removeItem("hielda_clone")
        if (d.cn) setCn(d.cn)
        if (d.ce) setCe(d.ce)
        if (d.ca) setCa(d.ca)
        if (d.lineItems?.length) setLineItems(d.lineItems)
        if (d.clientRef) setClientRef(d.clientRef)
        if (d.cc) setCc(d.cc)
        if (d.bcc) setBcc(d.bcc)
        if (d.terms) setTerms(d.terms)
        if (d.noFines) setNoFines(d.noFines)
        if (d.clientType) setClientType(d.clientType)
        const prefix = profile?.invoice_prefix || "INV"
        const num = profile?.next_invoice_number || 1
        setRef(`${prefix}-${String(num).padStart(4, "0")}`)
        return // Skip draft check if cloning
      }
    } catch {}
    try {
      const saved = localStorage.getItem(DRAFT_KEY(userId))
      if (saved) {
        const d = JSON.parse(saved)
        if (d.cn || d.ce || d.lineItems?.length || d.amt) setDraftBanner(true)
      }
    } catch {}
  }, [userId])

  // Auto-save draft whenever form changes
  useEffect(() => {
    if (!userId || step === 3) return
    try {
      localStorage.setItem(DRAFT_KEY(userId), JSON.stringify({ cn, ce, ca, lineItems, terms, customDays, date, noFines, clientType, clientRef, cc, bcc }))
    } catch {}
  }, [cn, ce, ca, lineItems, terms, customDays, date, noFines, clientType, clientRef, cc, bcc, userId, step])

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY(userId))
      if (!saved) return
      const d = JSON.parse(saved)
      if (d.cn !== undefined) setCn(d.cn)
      if (d.ce !== undefined) setCe(d.ce)
      if (d.ca !== undefined) setCa(d.ca)
      if (d.terms !== undefined) setTerms(d.terms)
      if (d.customDays !== undefined) setCustomDays(d.customDays)
      if (d.date !== undefined) setDate(d.date)
      if (d.noFines !== undefined) setNoFines(d.noFines)
      if (d.clientType !== undefined) setClientType(d.clientType)
      if (d.clientRef !== undefined) setClientRef(d.clientRef)
      if (d.cc !== undefined) setCc(d.cc)
      if (d.bcc !== undefined) setBcc(d.bcc)
      // New drafts have lineItems; legacy drafts had desc+amt — convert to single line item
      if (d.lineItems?.length) {
        setLineItems(d.lineItems)
      } else if (d.amt || d.desc) {
        setLineItems([{ description: d.desc || "", amount: d.amt || "" }])
      }
    } catch {}
    setDraftBanner(false)
  }

  const discardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY(userId)) } catch {}
    setDraftBanner(false)
  }

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY(userId)) } catch {}
  }

  const fillClient = (inv) => {
    setCn(inv.client_name || "")
    setCe(inv.client_email || "")
    setCa(inv.client_address || "")
    setCc(inv.cc_emails || "")
    setBcc(inv.bcc_emails || "")
  }

  const updateLineItem = (index, field, value) => {
    setLineItems(prev => prev.map((li, i) => i === index ? { ...li, [field]: value } : li))
  }
  const addLineItem = () => setLineItems(prev => [...prev, { description: "", amount: "", vatRate: defaultVatRate }])
  const removeLineItem = (index) => setLineItems(prev => prev.filter((_, i) => i !== index))

  const effectiveDays = terms === "-1" ? (parseInt(customDays) || 0) : parseInt(terms)
  const due = addDays(date, effectiveDays)
  const parsedTotal = round2(lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0))
  const isVatRegistered = profile?.vat_registered

  // VAT calculation per rate
  const vatBreakdown = lineItems.reduce((acc, li) => {
    const amt = parseFloat(li.amount) || 0
    const rate = li.vatRate || "0"
    if (rate === "exempt") return acc
    const rateNum = parseFloat(rate) || 0
    if (rateNum === 0 && rate !== "0") return acc
    acc[rate] = (acc[rate] || 0) + round2(amt * rateNum / 100)
    return acc
  }, {})
  const totalVat = isVatRegistered ? round2(Object.values(vatBreakdown).reduce((s, v) => s + v, 0)) : 0
  const totalWithVat = round2(parsedTotal + totalVat)
  const p = penalty(parsedTotal)

  // Validation
  const emailError = ce && !isValidEmail(ce) ? "Invalid email format" : ""
  const lineItemErrors = lineItems.map(li => {
    if (!li.amount && !li.description) return ""
    const v = parseFloat(li.amount)
    if (!li.description.trim()) return "Description required"
    if (!li.amount) return "Amount required"
    if (isNaN(v) || v <= 0) return "Must be > 0"
    return ""
  })
  const customDaysError = terms === "-1" && (!customDays || parseInt(customDays) < 1 || parseInt(customDays) > 365) ? "Enter 1–365 days" : ""
  const hasValidLineItems = lineItems.some(li => li.description.trim() && parseFloat(li.amount) > 0) && !lineItemErrors.some(Boolean)
  const canProceed = cn && ce && !emailError && hasValidLineItems && !customDaysError && effectiveDays > 0

  const buildIntroText = () => {
    const sender = profile?.business_name || profile?.full_name || "your contact"
    const client = cn || "there"
    return `Hi ${client},\n\nJust a quick note to let you know that ${sender} has recently started using Hielda to manage their invoicing and payments professionally. This has nothing to do with you specifically — it's simply good practice for independent professionals to have a dedicated system handling the admin side of things, because cashflow is critically important to individuals and small businesses.\n\nFrom now on, invoice-related communications may come via Hielda. Nothing changes on your side — you'll continue to receive invoices and payment reminders as normal. If you have any questions, please feel free to get in touch directly with ${sender}.\n\nWarm regards,\nThe Hielda team, on behalf of ${sender}`
  }

  const resetForm = () => {
    clearDraft()
    setCn("")
    setCe("")
    setCa("")
    setLineItems([{ description: "", amount: "", vatRate: defaultVatRate }])
    setStep(1)
    setMeth(null)
    setError("")
    setClientRef("")
    setCc("")
    setBcc("")
    const rPrefix = profile?.invoice_prefix || "INV"
    const rNum = (profile?.next_invoice_number || 1) + 1
    setRef(`${rPrefix}-${String(rNum).padStart(4, "0")}`)
    setSendIntro(false)
    setIntroMethod(null)
    setIntroText("")
    setIntroCopied(false)
  }

  const go = async () => {
    setSaving(true)
    setError("")
    try {
      const dueStr = due.toISOString().split("T")[0]
      const today = todayStr()
      const isOverdue = dueStr < today
      const validItems = lineItems.filter(li => li.description.trim() && parseFloat(li.amount) > 0)
      const { data: newInv, error: dbError } = await supabase.from("invoices").insert({
        user_id: userId,
        ref,
        description: validItems.map(li => li.description).join(", "),
        amount: parsedTotal,
        subtotal: parsedTotal,
        vat_amount: totalVat,
        total_with_vat: totalWithVat,
        line_items: validItems.map(li => ({ description: li.description.trim(), amount: parseFloat(li.amount), vatRate: li.vatRate || "0" })),
        issue_date: date,
        payment_term_days: effectiveDays,
        due_date: dueStr,
        status: isOverdue ? "overdue" : "pending",
        chase_stage: isOverdue ? "reminder_1" : null,
        send_method: meth,
        no_fines: clientType === "consumer" ? true : noFines,
        client_type: clientType,
        client_name: cn,
        client_email: ce,
        client_address: ca,
        client_ref: clientRef.trim() || null,
        cc_emails: cc.trim() || null,
        bcc_emails: bcc.trim() || null,
      }).select().single()
      if (dbError) throw dbError
      clearDraft()
      trackEvent("invoice_created", { amount: parsedTotal, line_items: validItems.length, send_method: meth })

      setNewInvId(newInv.id)

      // Atomically increment invoice number server-side to avoid race conditions
      await supabase.rpc("increment_invoice_number", { p_user_id: userId })
      onCreated()

      // Send client intro email if requested
      if (sendIntro && introMethod === "hielda") {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch("/api/send-intro-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: cn,
            client_email: ce,
            intro_text: introText,
            invoice_id: newInv.id,
            user_token: session?.access_token,
          }),
        })
      }

      setStep(3)
    } catch (e) {
      setError("Failed to create invoice: " + e.message)
    }
    setSaving(false)
  }

  const saveEdit = async () => {
    setSaving(true)
    setError("")
    try {
      const dueStr = due.toISOString().split("T")[0]
      const today = todayStr()
      const isOverdue = dueStr < today
      const validItems = lineItems.filter(li => li.description.trim() && parseFloat(li.amount) > 0)
      const { error: dbError } = await supabase.from("invoices").update({
        description: validItems.map(li => li.description).join(", "),
        amount: parsedTotal,
        subtotal: parsedTotal,
        vat_amount: totalVat,
        total_with_vat: totalWithVat,
        line_items: validItems.map(li => ({ description: li.description.trim(), amount: parseFloat(li.amount), vatRate: li.vatRate || "0" })),
        issue_date: date,
        payment_term_days: effectiveDays,
        due_date: dueStr,
        status: isOverdue ? "overdue" : "pending",
        no_fines: clientType === "consumer" ? true : noFines,
        client_type: clientType,
        client_name: cn,
        client_email: ce,
        client_address: ca,
        client_ref: clientRef.trim() || null,
        cc_emails: cc.trim() || null,
        bcc_emails: bcc.trim() || null,
      }).eq("id", editId)
      if (dbError) throw dbError
      clearDraft()
      trackEvent("invoice_edited", { amount: parsedTotal, ref })
      onCreated()
      nav("detail", editId)
    } catch (e) {
      setError("Failed to save changes: " + e.message)
    }
    setSaving(false)
  }

  const downloadPdf = async () => {
    if (!newInvId) return
    setDownloading(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-invoice-pdf", { body: { invoice_id: newInvId } })
      if (fnErr) throw fnErr
      const blob = new Blob([data], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${ref}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      trackEvent("pdf_downloaded", { ref })
    } catch (e) {
      setError("PDF generation failed: " + e.message)
    }
    setDownloading(false)
  }

  const needsPaymentDetails = !profile?.sort_code || !profile?.account_number

  if (needsPaymentDetails) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, textAlign: "center" }}>
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 16 }}>
          💳
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: c.tx, margin: "0 0 6px" }}>Payment details needed</h2>
        <p style={{ color: c.tm, fontSize: 13, marginBottom: 20, maxWidth: 360 }}>
          Add your bank details so they appear on invoices and clients know where to pay.
        </p>
        <Btn onClick={() => nav("settings")}>Add Payment Details</Btn>
      </div>
    )
  }

  if (step === 3) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, textAlign: "center" }}>
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: c.gnd, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 16 }}>
          ✓
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: c.tx, margin: "0 0 6px" }}>Invoice Created</h2>
        <p style={{ color: c.tm, fontSize: 13, marginBottom: 5 }}>{ref} · {fmt(isVatRegistered ? totalWithVat : parsedTotal)}{isVatRegistered && totalVat > 0 ? ` (inc. ${fmt(totalVat)} VAT)` : ""} · {cn}</p>
        <p style={{ color: c.tm, fontSize: 12, marginBottom: 20 }}>Hielda will chase automatically if unpaid by {formatDate(due)}.</p>

        {sendIntro && introMethod === "hielda" && (
          <div style={{ fontSize: 12, color: c.gn, marginBottom: 16, padding: "8px 16px", background: c.gnd, borderRadius: 8 }}>
            ✓ Introduction email sent to {cn}
          </div>
        )}

        {sendIntro && introMethod === "self" && (
          <div style={{ width: "100%", maxWidth: 480, marginBottom: 20, textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Copy and send this to {cn}
            </div>
            <textarea
              readOnly
              value={introText}
              style={{
                width: "100%", minHeight: 160, fontSize: 12, color: c.tx, fontFamily: FONT,
                padding: 12, borderRadius: 8, border: `1px solid ${c.bd}`, background: c.bg,
                resize: "none", boxSizing: "border-box", lineHeight: 1.6,
              }}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(introText); setIntroCopied(true) }}
              style={{
                marginTop: 8, width: "100%", padding: "8px", borderRadius: 8, fontSize: 12,
                fontWeight: 600, cursor: "pointer", fontFamily: FONT, border: `1.5px solid ${c.ac}`,
                background: introCopied ? c.acd : "#fff", color: c.ac,
              }}
            >
              {introCopied ? "✓ Copied!" : "Copy to clipboard"}
            </button>
          </div>
        )}

        {meth === "download" && (
          <div style={{ marginBottom: 16 }}>
            <Btn onClick={downloadPdf} dis={downloading}>
              {downloading ? "Generating PDF..." : "⬇ Download Invoice PDF"}
            </Btn>
            <p style={{ fontSize: 11, color: c.td, marginTop: 6 }}>Send this to your client directly — Hielda will still chase if unpaid.</p>
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn v={meth === "download" ? "ghost" : "primary"} onClick={() => nav("dash")}>Dashboard</Btn>
          <Btn v="ghost" onClick={resetForm}>Create Another</Btn>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => nav("dash")} style={{ background: "none", border: "none", color: c.tm, cursor: "pointer", fontFamily: FONT, fontSize: 13, padding: 0, marginBottom: 16 }}>
        ← Back
      </button>
      <h1 style={{ fontSize: 21, fontWeight: 700, color: c.tx, margin: "0 0 5px" }}>{isEditing ? `Edit Invoice ${ref}` : "Create Invoice"}</h1>
      <p style={{ color: c.tm, margin: "0 0 22px", fontSize: 13 }}>{isEditing ? "Update the details below and save your changes." : "Your details are pre-filled. Add client and job info."}</p>

      <div style={{ display: "flex", gap: 4, marginBottom: 22 }}>
        {["Client & Job", "Review & Send"].map((l, i) => (
          <div key={l} style={{ flex: 1 }}>
            <div style={{ height: 3, borderRadius: 2, background: i + 1 <= step ? c.ac : c.bd, marginBottom: 6 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: i + 1 <= step ? c.ac : c.td, textTransform: "uppercase", letterSpacing: "0.04em" }}>{l}</span>
          </div>
        ))}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {draftBanner && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: "#fffbeb", border: "1px solid #f59e0b40",
          borderRadius: 10, marginBottom: 16, gap: 12, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 13, color: c.tx }}>📝 You have a saved draft — want to restore it?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn sz="sm" onClick={restoreDraft}>Restore</Btn>
            <button onClick={discardDraft} style={{ background: "none", border: "none", color: c.td, cursor: "pointer", fontSize: 12, fontFamily: FONT }}>Discard</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18 }}>
          <Card>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: "0 0 14px" }}>Client</h3>
            {recentClients.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: c.td, marginBottom: 6 }}>Recent clients</div>
                {recentClients.length > 6 && (
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    placeholder="Search clients…"
                    style={{
                      width: "100%", padding: "7px 10px", marginBottom: 8,
                      border: `1px solid ${c.bd}`, borderRadius: 7, fontFamily: FONT,
                      fontSize: 12, color: c.tx, background: c.bg, outline: "none", boxSizing: "border-box",
                    }}
                  />
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {recentClients
                    .filter(i => !clientSearch || i.client_name.toLowerCase().includes(clientSearch.toLowerCase()) || i.client_email.toLowerCase().includes(clientSearch.toLowerCase()))
                    .map(inv => {
                      const active = cn === inv.client_name && ce === inv.client_email
                      return (
                        <div
                          key={inv.client_email}
                          style={{ display: "flex", alignItems: "center", borderRadius: 999, overflow: "hidden", border: `1px solid ${active ? c.ac : c.bd}` }}
                        >
                          <button
                            onClick={() => fillClient(inv)}
                            style={{
                              padding: "5px 10px 5px 12px", background: active ? c.acd : c.sf,
                              color: active ? c.ac : c.tm, border: "none",
                              fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: FONT,
                            }}
                          >
                            {inv.client_name}
                          </button>
                          <button
                            onClick={(e) => hideClient(inv.client_email, e)}
                            title="Remove from recent clients"
                            style={{
                              padding: "5px 8px", background: active ? c.acd : c.sf,
                              color: active ? c.ac : c.td, border: "none", borderLeft: `1px solid ${active ? c.ac + "40" : c.bd}`,
                              fontSize: 11, cursor: "pointer", fontFamily: FONT, lineHeight: 1,
                            }}
                          >×</button>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
            <Inp label="Company Name" value={cn} onChange={setCn} ph="e.g. Mega Corp Ltd" />
            <Inp label="Email" value={ce} onChange={setCe} ph="accounts@client.com" type="email" error={emailError} />
            <Inp label="Address" value={ca} onChange={setCa} ph="Full address" ta />
            <Inp label="CC (optional)" value={cc} onChange={setCc} ph="sarah@company.com, boss@company.com"
              error={cc.trim() && cc.split(",").some(e => e.trim() && !isValidEmail(e.trim())) ? "One or more CC emails are invalid" : ""} />
            <Inp label="BCC (optional)" value={bcc} onChange={setBcc} ph="accountant@mine.com"
              error={bcc.trim() && bcc.split(",").some(e => e.trim() && !isValidEmail(e.trim())) ? "One or more BCC emails are invalid" : ""} />
            <p style={{ fontSize: 11, color: c.td, margin: "-8px 0 8px" }}>
              Separate multiple emails with a comma. You'll always be CC'd automatically.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: "0 0 14px" }}>Job</h3>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.tm, marginBottom: 8 }}>Line Items</div>
              {!isMobile && (
                <div style={{ display: "grid", gridTemplateColumns: isVatRegistered ? "1fr auto auto auto" : "1fr auto auto", gap: "4px 8px", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: c.td, textTransform: "uppercase" }}>Description</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: c.td, textTransform: "uppercase" }}>Amount (£)</span>
                  {isVatRegistered && <span style={{ fontSize: 10, fontWeight: 600, color: c.td, textTransform: "uppercase" }}>VAT</span>}
                  <span />
                </div>
              )}
              {lineItems.map((li, i) => (
                <div key={i} style={isMobile
                  ? { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${c.bdl}` }
                  : { display: "grid", gridTemplateColumns: isVatRegistered ? "1fr auto auto auto" : "1fr auto auto", gap: "4px 8px", alignItems: "flex-start", marginBottom: 6 }
                }>
                  <div>
                    {isMobile && <span style={{ fontSize: 10, fontWeight: 600, color: c.td, textTransform: "uppercase" }}>Description</span>}
                    <input
                      type="text"
                      value={li.description}
                      onChange={(e) => updateLineItem(i, "description", e.target.value)}
                      placeholder="e.g. Video production"
                      style={{
                        width: "100%", padding: "9px 12px", background: c.bg,
                        border: `1px solid ${c.bd}`, borderRadius: 8, color: c.tx,
                        fontFamily: FONT, fontSize: 13, outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={isMobile ? { display: "flex", gap: 8, alignItems: "center" } : {}}>
                    <div style={{ flex: isMobile ? 1 : undefined }}>
                      {isMobile && <span style={{ fontSize: 10, fontWeight: 600, color: c.td, textTransform: "uppercase" }}>Amount (£)</span>}
                      <input
                        type="number"
                        value={li.amount}
                        onChange={(e) => updateLineItem(i, "amount", e.target.value)}
                        placeholder="0.00"
                        style={{
                          width: isMobile ? "100%" : 90, padding: "9px 12px", background: c.bg,
                          border: `1px solid ${lineItemErrors[i] ? c.or : c.bd}`,
                          borderRadius: 8, color: c.tx, fontFamily: MONO, fontSize: 13,
                          outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                    {isVatRegistered && (
                      <div style={{ flex: isMobile ? 1 : undefined }}>
                        {isMobile && <span style={{ fontSize: 10, fontWeight: 600, color: c.td, textTransform: "uppercase" }}>VAT Rate</span>}
                        <select
                          value={li.vatRate || "20"}
                          onChange={(e) => updateLineItem(i, "vatRate", e.target.value)}
                          style={{
                            width: isMobile ? "100%" : 90, padding: "9px 8px", background: c.bg,
                            border: `1px solid ${c.bd}`, borderRadius: 8, color: c.tx,
                            fontFamily: FONT, fontSize: 12, outline: "none", boxSizing: "border-box",
                            cursor: "pointer",
                          }}
                        >
                          <option value="20">20%</option>
                          <option value="5">5%</option>
                          <option value="0">0%</option>
                          <option value="exempt">Exempt</option>
                        </select>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeLineItem(i)}
                      disabled={lineItems.length === 1}
                      style={{
                        padding: "9px 11px", background: "none",
                        border: `1px solid ${c.bd}`, borderRadius: 8, color: c.td,
                        cursor: lineItems.length === 1 ? "not-allowed" : "pointer",
                        fontSize: 14, fontFamily: FONT, opacity: lineItems.length === 1 ? 0.3 : 1,
                        flexShrink: 0,
                      }}
                      aria-label="Remove line"
                    >×</button>
                  </div>
                  {lineItemErrors[i] && (
                    <div style={{ gridColumn: "1/-1", fontSize: 11, color: c.or, marginTop: -2, marginBottom: 2 }}>{lineItemErrors[i]}</div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addLineItem}
                style={{
                  width: "100%", padding: "8px", background: "none",
                  border: `1px dashed ${c.bd}`, borderRadius: 8, color: c.tm,
                  cursor: "pointer", fontSize: 12, fontFamily: FONT, marginTop: 2,
                }}
              >+ Add line</button>
              {parsedTotal > 0 && (
                <div style={{ borderTop: `1px solid ${c.bdl}`, marginTop: 8, paddingTop: 8 }}>
                  {isVatRegistered && totalVat > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.tm, marginBottom: 4 }}>
                        <span>Subtotal (ex. VAT)</span>
                        <span style={{ fontFamily: MONO }}>{fmt(parsedTotal)}</span>
                      </div>
                      {Object.entries(vatBreakdown).filter(([, v]) => v > 0).map(([rate, amount]) => (
                        <div key={rate} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.tm, marginBottom: 4 }}>
                          <span>VAT @ {rate}%</span>
                          <span style={{ fontFamily: MONO }}>{fmt(amount)}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                    <span style={{ color: c.tm }}>{isVatRegistered && totalVat > 0 ? "Total (inc. VAT)" : "Total"}</span>
                    <span style={{ fontFamily: MONO, color: c.ac }}>{fmt(isVatRegistered ? totalWithVat : parsedTotal)}</span>
                  </div>
                </div>
              )}
            </div>
            <Inp label="Client reference / PO number (optional)" value={clientRef} onChange={setClientRef} ph="e.g. PO-4821" />
            <Sel label="Payment Terms" value={terms} onChange={(v) => { setTerms(v); if (v !== "-1") setCustomDays(""); }} opts={TERMS.map((t) => ({ l: t.l, v: String(t.d) }))} />
            {terms === "-1" && (
              <Inp label="Custom Days" value={customDays} onChange={setCustomDays} ph="e.g. 21" type="number" mono error={customDaysError} />
            )}
            <Inp label="Issue Date" value={date} onChange={setDate} type="date" />

            {/* Client type toggle */}
            <div style={{ marginTop: 6, marginBottom: 4 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.tx, marginBottom: 6 }}>Client type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ v: "business", l: "Business (B2B)" }, { v: "consumer", l: "Consumer (individual)" }].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setClientType(opt.v)}
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      fontFamily: FONT, border: `1.5px solid ${clientType === opt.v ? c.ac : c.bd}`,
                      background: clientType === opt.v ? c.acd : c.sf,
                      color: clientType === opt.v ? c.ac : c.tm,
                    }}
                  >{opt.l}</button>
                ))}
              </div>
              {clientType === "consumer" && (
                <p style={{ fontSize: 11, color: c.tm, margin: "6px 0 0", lineHeight: 1.5 }}>
                  Payment terms will be added to the invoice (contractual interest at {getRate()}% p.a. if overdue). No statutory fixed penalty applies to consumer invoices.
                </p>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 4, ...(clientType === "consumer" ? { display: "none" } : {}) }}>
              <input type="checkbox" id="noFines" checked={noFines} onChange={(e) => setNoFines(e.target.checked)} style={{ accentColor: c.ac, width: 16, height: 16 }} />
              <label htmlFor="noFines" style={{ fontSize: 12, color: c.tm, cursor: "pointer" }}>
                Chase without fines or interest
              </label>
              <button
                type="button"
                onClick={() => setShowNoFinesInfo(v => !v)}
                style={{
                  width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${c.bd}`,
                  background: showNoFinesInfo ? c.acd : c.sf, color: showNoFinesInfo ? c.ac : c.td,
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0,
                }}
                aria-label="About this option"
              >
                ?
              </button>
            </div>
            {showNoFinesInfo && (
              <div style={{
                marginTop: 4, marginBottom: 4, padding: "10px 12px", background: c.acd, borderRadius: 8,
                border: `1px solid ${c.ac}30`, fontSize: 12, color: c.tx, lineHeight: 1.6,
              }}>
                Hielda will still chase this invoice on your behalf and send all the usual reminder and chase emails — but the emails won't reference any additional fines or interest on top of the original invoice amount. Useful if you'd prefer to keep things informal with a particular client.
              </div>
            )}
            {noFines && !showNoFinesInfo && (
              <div style={{ fontSize: 11, color: c.td, marginBottom: 4, paddingLeft: 24 }}>
                We'll still send chase emails, but won't add statutory penalties or interest.
              </div>
            )}
            <div style={{ marginTop: 10, padding: 10, background: c.bg, borderRadius: 8, border: `1px solid ${c.bd}`, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: c.tm }}>Ref</span>
                <span style={{ fontFamily: MONO, color: c.ac }}>{ref}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={{ color: c.tm }}>Due</span>
                <span style={{ color: c.tx, fontWeight: 500 }}>{formatDate(due)}</span>
              </div>
              {parsedTotal > 0 && !noFines && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, color: c.td, fontSize: 11 }}>
                  <span>Late penalty</span>
                  <span>{fmt(p)} + {getRate()}% p.a.</span>
                </div>
              )}
              {parsedTotal > 0 && noFines && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, color: c.td, fontSize: 11 }}>
                  <span>Late penalty</span>
                  <span style={{ fontStyle: "italic" }}>Waived</span>
                </div>
              )}
            </div>
          </Card>
          {/* Existing client intro */}
          <div style={{ gridColumn: "1/-1" }}>
            <Card>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input
                  type="checkbox"
                  id="sendIntro"
                  checked={sendIntro}
                  onChange={(e) => {
                    setSendIntro(e.target.checked)
                    if (e.target.checked && !introText) setIntroText(buildIntroText())
                  }}
                  style={{ accentColor: c.ac, width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label htmlFor="sendIntro" style={{ fontSize: 13, fontWeight: 600, color: c.tx, cursor: "pointer" }}>
                      Send {cn || "this client"} a friendly introduction to Hielda
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowIntroInfo(v => !v)}
                      style={{
                        width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${c.bd}`,
                        background: showIntroInfo ? c.acd : c.sf, color: showIntroInfo ? c.ac : c.td,
                        fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0,
                      }}
                      aria-label="About this feature"
                    >
                      ?
                    </button>
                  </div>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: c.tm, marginTop: 2 }}>
                    For existing clients you now want to manage through Hielda.
                  </span>
                  {showIntroInfo && (
                    <div style={{
                      marginTop: 8, padding: "10px 12px", background: c.acd, borderRadius: 8,
                      border: `1px solid ${c.ac}30`, fontSize: 12, color: c.tx, lineHeight: 1.6,
                    }}>
                      <strong style={{ color: c.ac }}>What this does:</strong> Sends a professional, friendly email to your client explaining that you've started using Hielda to manage your invoicing. It reassures them that nothing changes on their end — they'll still receive invoices and reminders as normal. This is especially useful for long-standing clients who might be surprised to receive emails from Hielda.
                    </div>
                  )}
                </div>
              </div>

              {sendIntro && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                    Email text — edit freely
                  </div>
                  <textarea
                    value={introText}
                    onChange={(e) => setIntroText(e.target.value)}
                    style={{
                      width: "100%", minHeight: 180, fontSize: 12, color: c.tx, fontFamily: FONT,
                      padding: 12, borderRadius: 8, border: `1px solid ${c.bd}`, background: c.bg,
                      resize: "vertical", boxSizing: "border-box", lineHeight: 1.6,
                    }}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setIntroMethod("hielda")}
                      style={{
                        padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: FONT, border: `1.5px solid ${introMethod === "hielda" ? c.ac : c.bd}`,
                        background: introMethod === "hielda" ? c.acd : "#fff", color: introMethod === "hielda" ? c.ac : c.tm,
                      }}
                    >
                      📧 Hielda sends it for me
                    </button>
                    <button
                      onClick={() => setIntroMethod("self")}
                      style={{
                        padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: FONT, border: `1.5px solid ${introMethod === "self" ? c.ac : c.bd}`,
                        background: introMethod === "self" ? c.acd : "#fff", color: introMethod === "self" ? c.ac : c.tm,
                      }}
                    >
                      ✍️ I'll send it myself
                    </button>
                  </div>
                  {introMethod === "self" && (
                    <div style={{ marginTop: 10, fontSize: 11, color: c.tm, padding: "8px 12px", background: c.bg, borderRadius: 8, border: `1px solid ${c.bd}` }}>
                      We'll show you this text to copy after the invoice is created.
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end" }}>
            {isEditing
              ? <Btn dis={!canProceed || saving} onClick={saveEdit}>{saving ? "Saving..." : "Save Changes"}</Btn>
              : <Btn dis={!canProceed} onClick={() => setStep(2)}>Review →</Btn>
            }
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          {due < new Date(todayStr()) && (
            <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #f59e0b40", borderRadius: 8, fontSize: 12, color: c.tx, marginBottom: 14, lineHeight: 1.5 }}>
              ⚠️ <strong>This invoice is already overdue.</strong> Hielda will begin chasing immediately after creation.
            </div>
          )}
          <Card style={{ marginBottom: 16, background: "#fff", borderRadius: 12 }}>
            <div style={{ padding: "18px 26px 14px", borderBottom: `2px solid ${c.ac}` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: c.ac, marginBottom: 3 }}>INVOICE</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: c.tx }}>{ref}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: c.tx }}>{profile?.business_name || profile?.full_name || ""}</div>
                  <div style={{ fontSize: 11, color: c.tm, whiteSpace: "pre-line", marginTop: 2 }}>{profile?.address || ""}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 26px" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: c.td, marginBottom: 3 }}>Bill To</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: c.tx }}>{cn}</div>
                  <div style={{ fontSize: 11, color: c.tm, whiteSpace: "pre-line" }}>{ca}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: c.tm }}>
                  <div>Issue: {formatDate(date)}</div>
                  <div>Due: {formatDate(due)}</div>
                  <div>Terms: {effectiveDays} days</div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${c.bdl}`, borderBottom: `1px solid ${c.bdl}`, padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0 5px", fontSize: 10, fontWeight: 600, color: c.td, textTransform: "uppercase" }}>
                  <span>Description</span><span>Amount</span>
                </div>
                {lineItems.filter(li => li.description || li.amount).map((li, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderTop: i > 0 ? `1px solid ${c.bdl}` : "none" }}>
                    <span style={{ color: c.tx }}>{li.description || <em style={{ color: c.td }}>No description</em>}</span>
                    <span style={{ fontFamily: MONO }}>{fmt(parseFloat(li.amount) || 0)}</span>
                  </div>
                ))}
              </div>
              {isVatRegistered && totalVat > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${c.bdl}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.tm, marginBottom: 3 }}>
                    <span>Subtotal (ex. VAT)</span>
                    <span style={{ fontFamily: MONO }}>{fmt(parsedTotal)}</span>
                  </div>
                  {Object.entries(vatBreakdown).filter(([, v]) => v > 0).map(([rate, amount]) => (
                    <div key={rate} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.tm, marginBottom: 3 }}>
                      <span>VAT @ {rate}%</span>
                      <span style={{ fontFamily: MONO }}>+{fmt(amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: isVatRegistered && totalVat > 0 ? 6 : 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: c.tx }}>
                  {isVatRegistered && totalVat > 0 ? "Total (inc. VAT)" : "Total Due"}
                </span>
                <span style={{ fontWeight: 700, fontSize: 18, color: c.ac, fontFamily: MONO }}>
                  {fmt(isVatRegistered ? totalWithVat : parsedTotal)}
                </span>
              </div>
              <div style={{ marginTop: 14, padding: 11, background: c.bg, borderRadius: 8, fontSize: 11, color: c.tm }}>
                <div style={{ fontWeight: 600, color: c.tx, marginBottom: 4 }}>Payment Details</div>
                <div>Sort Code: {profile?.sort_code || "—"} · Account: {profile?.account_number || "—"} · Ref: {ref}</div>
              </div>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <Card onClick={() => setMeth("portal")} style={{ cursor: "pointer", textAlign: "center", borderColor: meth === "portal" ? c.ac : c.bd, background: meth === "portal" ? c.acd : c.sf }}>
              <div style={{ fontSize: 22, marginBottom: 5 }} aria-hidden="true">📧</div>
              <div style={{ fontWeight: 600, color: c.tx, fontSize: 13 }}>Send via Hielda</div>
              <div style={{ fontSize: 11, color: c.tm, marginTop: 3 }}>We email and track automatically.</div>
            </Card>
            <Card onClick={() => setMeth("download")} style={{ cursor: "pointer", textAlign: "center", borderColor: meth === "download" ? c.ac : c.bd, background: meth === "download" ? c.acd : c.sf }}>
              <div style={{ fontSize: 22, marginBottom: 5 }} aria-hidden="true">📥</div>
              <div style={{ fontWeight: 600, color: c.tx, fontSize: 13 }}>Download & Send</div>
              <div style={{ fontSize: 11, color: c.tm, marginTop: 3 }}>We still track and chase for you.</div>
            </Card>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Btn v="ghost" onClick={() => setStep(1)}>← Back</Btn>
            <Btn dis={!meth || saving} onClick={go}>
              {saving ? "Creating..." : meth === "portal" ? "Send Invoice" : "Create & Download"} →
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
