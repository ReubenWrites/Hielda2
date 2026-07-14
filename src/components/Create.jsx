import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Check } from "lucide-react"
import { supabase } from "../supabase"
import { colors as c, TERMS, getRate } from "../constants"
import { penalty, fmt, formatDate, addDays, generateRef, todayStr, isValidEmail, round2 } from "../utils"
import { Card, Inp, Sel, Btn, ErrorBanner, CollapsibleSection, useToast } from "./ui"
import { trackEvent } from "../posthog"
import { buildIntroText as buildIntroTextLib } from "../lib/introText"
import s from "./Create.module.css"

const DRAFT_KEY = (userId) => `hielda_draft_${userId}`

export default function Create({ profile, userId, onCreated, isMobile, invs }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  // Server-side draft being edited (invoice_drafts row id). Set when the
  // user arrives via a dashboard draft's Resume link or after "Save &
  // finish later"; the row is deleted once the invoice is created.
  const [draftId, setDraftId] = useState(null)
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
  // Default to send-via-Hielda; users opt out via checkbox in step 2.
  const [meth, setMeth] = useState("portal")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [ref, setRef] = useState(() => {
    const prefix = profile?.invoice_prefix || "INV"
    const num = profile?.next_invoice_number || 1
    return `${prefix}-${String(num).padStart(4, "0")}`
  })
  const [clientType, setClientType] = useState("business")
  const [noFines, setNoFines] = useState(false)
  // Whether Hielda chases this invoice automatically (check-ins + chase
  // emails). Surfaced as a first-class switch on step 1.
  const [autoChase, setAutoChase] = useState(true)
  const [newInvId, setNewInvId] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)
  const [notes, setNotes] = useState("")
  const [clientRef, setClientRef] = useState("")
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [sendIntro, setSendIntro] = useState(true)
  // Default to having Hielda send the intro+invoice email — without this
  // default, picking "Send via Hielda" in step 2 silently delivered nothing
  // to the client because go() only fires the email when both flags are set.
  const [introMethod, setIntroMethod] = useState("hielda")
  const [introSendError, setIntroSendError] = useState("")
  const [introText, setIntroText] = useState("")
  // Tracks whether the user has typed in the intro textarea. While false,
  // the textarea auto-fills from buildIntroText() so users see Hielda's
  // ready-made introduction rather than an empty box. Once they touch it,
  // we stop overwriting their changes.
  const [introTextEdited, setIntroTextEdited] = useState(false)
  const [introCopied, setIntroCopied] = useState(false)
  // Per-line-item flag for whether the description input is expanded into
  // a multi-line textarea. Indexed by line item position.
  const [expandedDescs, setExpandedDescs] = useState({})
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

  // Check for a server draft (?draft=id from the dashboard), clone data,
  // or a locally autosaved draft on mount — in that priority order.
  useEffect(() => {
    if (!userId) return
    const serverDraftId = searchParams.get("draft")
    if (serverDraftId) {
      ;(async () => {
        const { data } = await supabase
          .from("invoice_drafts")
          .select("id, payload")
          .eq("id", serverDraftId)
          .eq("user_id", userId)
          .maybeSingle()
        if (data?.payload) {
          setDraftId(data.id)
          applyDraftPayload(data.payload)
        }
      })()
      return // Server draft wins — skip edit/clone/local-draft checks
    }
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
        setNotes(inv.notes || "")
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
        // Only offer restore when the draft actually contains something —
        // lineItems always has one blank row, so its length alone doesn't
        // mean there's content (that used to trigger the banner for empty
        // drafts, and Restore would visibly do nothing).
        const hasDraftContent = d.cn || d.ce || d.ca || d.notes || d.cc || d.bcc || d.clientRef || d.amt || d.desc ||
          d.lineItems?.some(li => li.description || li.amount)
        if (hasDraftContent) setDraftBanner(true)
      }
    } catch {}
  }, [userId])

  const hasContent = Boolean(
    cn || ce || ca || notes || cc || bcc || clientRef ||
    lineItems.some(li => li.description || li.amount)
  )

  // Auto-save draft whenever form changes.
  //
  // Guards fix the bug where re-entering this page instantly overwrote a
  // saved draft with the blank initial form — making the Restore button
  // appear to do nothing:
  //  - skip the mount run (initial state isn't user input)
  //  - never save an effectively-empty form
  //  - never save while editing an existing invoice (edits are saved via
  //    "Save Changes", and a stale "draft" of an edit is confusing)
  //  - while the restore banner is up, the first real edit counts as an
  //    implicit "start fresh": dismiss the banner, then start saving
  const autosaveMounted = useRef(false)
  useEffect(() => {
    if (!autosaveMounted.current) { autosaveMounted.current = true; return }
    if (!userId || step === 3 || isEditing || !hasContent) return
    if (draftBanner) setDraftBanner(false)
    try {
      localStorage.setItem(DRAFT_KEY(userId), JSON.stringify({ cn, ce, ca, lineItems, terms, customDays, date, noFines, autoChase, sendIntro, clientType, clientRef, cc, bcc, notes, savedAt: Date.now() }))
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cn, ce, ca, lineItems, terms, customDays, date, noFines, autoChase, sendIntro, clientType, clientRef, cc, bcc, notes, userId, step])

  // Shared between the localStorage restore banner and server-draft resume.
  const applyDraftPayload = (d) => {
    if (d.cn !== undefined) setCn(d.cn)
    if (d.ce !== undefined) setCe(d.ce)
    if (d.ca !== undefined) setCa(d.ca)
    if (d.terms !== undefined) setTerms(d.terms)
    if (d.customDays !== undefined) setCustomDays(d.customDays)
    if (d.date !== undefined) setDate(d.date)
    if (d.noFines !== undefined) setNoFines(d.noFines)
    if (d.autoChase !== undefined) setAutoChase(d.autoChase)
    if (d.sendIntro !== undefined) setSendIntro(d.sendIntro)
    if (d.clientType !== undefined) setClientType(d.clientType)
    if (d.clientRef !== undefined) setClientRef(d.clientRef)
    if (d.cc !== undefined) setCc(d.cc)
    if (d.bcc !== undefined) setBcc(d.bcc)
    if (d.notes !== undefined) setNotes(d.notes)
    // New drafts have lineItems; legacy drafts had desc+amt — convert to single line item
    if (d.lineItems?.length) {
      setLineItems(d.lineItems)
    } else if (d.amt || d.desc) {
      setLineItems([{ description: d.desc || "", amount: d.amt || "" }])
    }
  }

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY(userId))
      if (!saved) return
      applyDraftPayload(JSON.parse(saved))
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

  // CC/BCC are remembered per client: the most recent invoice to this
  // client that had them set is the source of truth, even if their very
  // latest invoice didn't. invs is ordered newest-first.
  const savedRecipientsFor = (email) => {
    if (!email) return { cc: "", bcc: "" }
    const norm = email.trim().toLowerCase()
    const withCc = invs?.find(i => i.client_email?.toLowerCase() === norm && i.cc_emails)
    const withBcc = invs?.find(i => i.client_email?.toLowerCase() === norm && i.bcc_emails)
    return { cc: withCc?.cc_emails || "", bcc: withBcc?.bcc_emails || "" }
  }

  const [ccAutoFilled, setCcAutoFilled] = useState(false)

  const [savingDraft, setSavingDraft] = useState(false)
  const saveDraftAndLeave = async () => {
    // Saves to the server so the draft is visible on the dashboard and
    // follows the user across devices — the old localStorage-only draft
    // was a single invisible slot that users couldn't find again.
    if (savingDraft) return
    setSavingDraft(true)
    const payload = { cn, ce, ca, lineItems, terms, customDays, date, noFines, autoChase, sendIntro, clientType, clientRef, cc, bcc, notes }
    const display = {
      client_name: cn.trim() || null,
      amount: parsedTotal > 0 ? parsedTotal : null,
    }
    try {
      if (draftId) {
        const { error: err } = await supabase
          .from("invoice_drafts")
          .update({ payload, ...display, updated_at: new Date().toISOString() })
          .eq("id", draftId)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase
          .from("invoice_drafts")
          .insert({ user_id: userId, payload, ...display })
          .select("id")
          .single()
        if (err) throw err
        setDraftId(data.id)
      }
      clearDraft() // server copy is now the source of truth
      trackEvent("invoice_draft_saved_manually")
      toast.success("Draft saved — resume it from your dashboard any time")
      navigate("/dashboard")
    } catch (e) {
      // Fall back to the local autosave so nothing is lost, and say so.
      try {
        localStorage.setItem(DRAFT_KEY(userId), JSON.stringify({ ...payload, savedAt: Date.now() }))
      } catch {}
      toast.error("Couldn't save to your account (" + e.message + ") — kept a local copy on this device instead")
    }
    setSavingDraft(false)
  }

  const fillClient = (inv) => {
    setCn(inv.client_name || "")
    setCe(inv.client_email || "")
    setCa(inv.client_address || "")
    const saved = savedRecipientsFor(inv.client_email)
    setCc(inv.cc_emails || saved.cc)
    setBcc(inv.bcc_emails || saved.bcc)
    setCcAutoFilled(Boolean(!inv.cc_emails && saved.cc))
  }

  // When a known client email is typed by hand, quietly restore the CC
  // they've used before (only if the CC field is still empty — never
  // overwrite something the user has entered this session).
  const prefillRecipientsForEmail = () => {
    if (cc.trim()) return
    const saved = savedRecipientsFor(ce)
    if (saved.cc) {
      setCc(saved.cc)
      setCcAutoFilled(true)
      if (!bcc.trim() && saved.bcc) setBcc(saved.bcc)
    }
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

  const buildIntroText = () => buildIntroTextLib(profile, cn)

  // Pre-fill the intro textarea so users see what'll be sent to the client
  // by default, instead of an empty box. Re-fills as cn / profile change,
  // but stops once the user manually edits the textarea.
  useEffect(() => {
    if (!sendIntro || introTextEdited) return
    setIntroText(buildIntroTextLib(profile, cn))
  }, [sendIntro, cn, profile, introTextEdited])

  const resetForm = () => {
    clearDraft()
    setCn("")
    setCe("")
    setCa("")
    setLineItems([{ description: "", amount: "", vatRate: defaultVatRate }])
    setStep(1)
    setMeth("portal")
    setError("")
    setClientRef("")
    setCc("")
    setBcc("")
    setNotes("")
    const rPrefix = profile?.invoice_prefix || "INV"
    const rNum = (profile?.next_invoice_number || 1) + 1
    setRef(`${rPrefix}-${String(rNum).padStart(4, "0")}`)
    setSendIntro(false)
    setIntroMethod("hielda")
    setIntroSendError("")
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
        auto_chase: autoChase,
        no_fines: clientType === "consumer" ? true : noFines,
        client_type: clientType,
        client_name: cn,
        client_email: ce,
        client_address: ca,
        client_ref: clientRef.trim() || null,
        cc_emails: cc.trim() || null,
        bcc_emails: bcc.trim() || null,
        notes: notes.trim() || null,
      }).select().single()
      if (dbError) throw dbError
      clearDraft()
      // The draft has become a real invoice — remove it from the dashboard.
      if (draftId) {
        supabase.from("invoice_drafts").delete().eq("id", draftId).then(() => {})
        setDraftId(null)
      }
      trackEvent("invoice_created", { amount: parsedTotal, line_items: validItems.length, send_method: meth })

      setNewInvId(newInv.id)

      // Atomically increment invoice number server-side to avoid race conditions
      await supabase.rpc("increment_invoice_number", { p_user_id: userId })
      onCreated()

      // Send client intro email if requested. The invoice is already saved
      // at this point — if the email fails we still advance to step 3 and
      // surface the failure there so the user can retry/download instead of
      // silently believing the client received it.
      setIntroSendError("")
      if (sendIntro && introMethod === "hielda") {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          // Belt-and-braces fallback in case introText somehow isn't
          // populated by the time go() fires (e.g. profile loads later
          // than the form submit). The textarea is also pre-filled by
          // a useEffect, so this almost always passes through unchanged.
          const finalIntroText = introText.trim() || buildIntroText()
          const introRes = await fetch("/api/send-intro-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_name: cn,
              client_email: ce,
              intro_text: finalIntroText,
              invoice_id: newInv.id,
              user_token: session?.access_token,
            }),
          })
          if (!introRes.ok) {
            const text = await introRes.text()
            let msg = text
            try { msg = JSON.parse(text).error || text } catch {}
            setIntroSendError(msg || `Email send failed (${introRes.status})`)
          }
        } catch (e) {
          setIntroSendError(e.message || "Email send failed")
        }
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
        ref: ref.trim(),
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
        notes: notes.trim() || null,
      }).eq("id", editId)
      if (dbError) throw dbError
      clearDraft()
      trackEvent("invoice_edited", { amount: parsedTotal, ref })
      onCreated()
      navigate(`/invoice/${editId}`)
    } catch (e) {
      setError("Failed to save changes: " + e.message)
    }
    setSaving(false)
  }

  const downloadPdf = async () => {
    if (!newInvId) return
    setDownloading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const apikey = import.meta.env.VITE_SUPABASE_KEY
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice-pdf`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey,
          Authorization: `Bearer ${session?.access_token || apikey}`,
        },
        body: JSON.stringify({ invoice_id: newInvId }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = text
        try { msg = JSON.parse(text).error || text } catch {}
        throw new Error(msg || `PDF generation failed (${res.status})`)
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = `${ref}.pdf`
      a.click()
      URL.revokeObjectURL(objectUrl)
      trackEvent("pdf_downloaded", { ref })
    } catch (e) {
      setError("PDF generation failed: " + e.message)
    }
    setDownloading(false)
  }

  const needsPaymentDetails = !profile?.sort_code || !profile?.account_number

  if (needsPaymentDetails) {
    return (
      <div className={s.centerWrap}>
        <div className={`${s.iconCircle} ${s.iconCircleWarning}`}>💳</div>
        <h2 className={s.heading}>Payment details needed</h2>
        <p className={s.subtextMuted}>
          Add your bank details so they appear on invoices and clients know where to pay.
        </p>
        <Btn onClick={() => navigate("/settings")}>Add Payment Details</Btn>
      </div>
    )
  }

  if (step === 3) {
    return (
      <div className={s.centerWrap}>
        <div className={`${s.iconCircle} ${s.iconCircleSuccess}`}>✓</div>
        <h2 className={s.heading}>Invoice Created</h2>
        <p className={s.successRef}>{ref} · {fmt(isVatRegistered ? totalWithVat : parsedTotal)}{isVatRegistered && totalVat > 0 ? ` (inc. ${fmt(totalVat)} VAT)` : ""} · {cn}</p>
        <p className={s.subtextSmall}>Hielda will chase automatically if unpaid by {formatDate(due)}.</p>

        {sendIntro && introMethod === "hielda" && !introSendError && (
          <div className={s.introSentBadge}>✓ Introduction email sent to {cn}</div>
        )}
        {sendIntro && introMethod === "hielda" && introSendError && (
          <div role="alert" className={s.introSendErrorBanner}>
            <strong>⚠ Email to {cn} failed:</strong> {introSendError}
            <div className={s.introSendErrorHint}>
              The invoice is saved. Open it from the dashboard to retry sending, or download the PDF below.
            </div>
          </div>
        )}

        {sendIntro && introMethod === "self" && (
          <div className={s.introSelfWrap}>
            <div className={s.sectionLabel}>Copy and send this to {cn}</div>
            <textarea readOnly value={introText} className={s.introTextarea} />
            <button
              onClick={() => { navigator.clipboard.writeText(introText); setIntroCopied(true) }}
              className={introCopied ? s.copyBtnDone : s.copyBtn}
            >
              {introCopied ? "✓ Copied!" : "Copy to clipboard"}
            </button>
          </div>
        )}

        {(meth === "download" || introSendError) && (
          <div className={s.downloadWrap}>
            <Btn onClick={downloadPdf} dis={downloading}>
              {downloading ? "Generating PDF..." : "⬇ Download Invoice PDF"}
            </Btn>
            <p className={s.downloadHint}>Send this to your client directly — Hielda will still chase if unpaid.</p>
          </div>
        )}
        <div className={s.btnRow}>
          <Btn v={meth === "download" ? "ghost" : "primary"} onClick={() => navigate("/dashboard")}>Dashboard</Btn>
          <Btn v="ghost" onClick={resetForm}>Create Another</Btn>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => navigate("/dashboard")} className={s.backBtn}>← Back</button>
      <h1 className={s.pageTitle}>{isEditing ? `Edit Invoice ${ref}` : "Create Invoice"}</h1>
      <p className={s.pageDesc}>{isEditing ? "Update the details below and save your changes." : "Your details are pre-filled. Add client and job info."}</p>

      <div className={s.progressRow}>
        {["Client & Job", "Review & Send"].map((l, i) => (
          <div key={l} className={s.progressItem}>
            <div className={`${s.progressBar} ${i + 1 <= step ? s.progressBarActive : s.progressBarInactive}`} />
            <span className={`${s.progressLabel} ${i + 1 <= step ? s.progressLabelActive : s.progressLabelInactive}`}>{l}</span>
          </div>
        ))}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {draftBanner && (
        <div className={s.draftBanner}>
          <span className={s.draftText}>You have an unfinished invoice — want to pick up where you left off?</span>
          <div className={s.draftBtnRow}>
            <Btn sz="sm" onClick={restoreDraft}>Restore</Btn>
            <button onClick={discardDraft} className={s.discardBtn}>Discard</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className={s.step1Grid}>
          <Card>
            <h3 className={s.cardHeading}>Client</h3>
            {recentClients.length > 0 && (
              <div className={s.recentWrap}>
                <div className={s.recentLabel}>Recent clients</div>
                {recentClients.length > 6 && (
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    placeholder="Search clients…"
                    className={s.clientSearchInput}
                  />
                )}
                <div className={s.clientChips}>
                  {recentClients
                    .filter(i => !clientSearch || i.client_name.toLowerCase().includes(clientSearch.toLowerCase()) || i.client_email.toLowerCase().includes(clientSearch.toLowerCase()))
                    .map(inv => {
                      const active = cn === inv.client_name && ce === inv.client_email
                      return (
                        <div key={inv.client_email} className={active ? s.chipWrapActive : s.chipWrap}>
                          <button onClick={() => fillClient(inv)} className={active ? s.chipBtnActive : s.chipBtn}>
                            {inv.client_name}
                          </button>
                          <button
                            onClick={(e) => hideClient(inv.client_email, e)}
                            title="Remove from recent clients"
                            className={active ? s.chipRemoveActive : s.chipRemove}
                          >×</button>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
            <Inp label="Company Name" value={cn} onChange={setCn} ph="e.g. Mega Corp Ltd"
              autoComplete="organization" autoCapitalize="words" enterKeyHint="next" />
            <Inp label="Email" value={ce} onChange={setCe} onBlur={prefillRecipientsForEmail} ph="accounts@client.com" type="email" error={emailError}
              inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" />
            {ccAutoFilled && cc.trim() && (
              <p className={s.ccRestoredNote}>
                <Check size={12} strokeWidth={3} /> {cc} will be CC'd — restored from your last invoice to this client. Change it under "Address &amp; recipients" below.
              </p>
            )}
          </Card>
          <Card>
            <h3 className={s.cardHeading}>Job</h3>
            <div className={s.lineItemsWrap}>
              <div className={s.lineItemsLabel}>Line Items</div>
              {!isMobile && (
                <div className={isVatRegistered ? s.lineItemsHeaderVat : s.lineItemsHeaderNoVat}>
                  <span className={s.colLabel}>Description</span>
                  <span className={s.colLabel}>Amount (£)</span>
                  {isVatRegistered && <span className={s.colLabel}>VAT</span>}
                  <span />
                </div>
              )}
              {lineItems.map((li, i) => (
                <div key={i} className={isMobile ? s.lineRowMobile : (isVatRegistered ? s.lineRowVat : s.lineRowNoVat)}>
                  <div>
                    {isMobile && <span className={s.colLabel}>Description</span>}
                    <div className={s.lineDescWrap}>
                      {expandedDescs[i] ? (
                        <textarea
                          value={li.description}
                          onChange={(e) => updateLineItem(i, "description", e.target.value)}
                          placeholder="e.g. Video production"
                          className={s.lineInputExpanded}
                          rows={isMobile ? 6 : 4}
                          autoCapitalize="sentences"
                        />
                      ) : (
                        <input
                          type="text"
                          value={li.description}
                          onChange={(e) => updateLineItem(i, "description", e.target.value)}
                          // If someone pastes multi-line content (eg pulled from
                          // an email with a date + address + ref on separate
                          // lines), auto-expand so they can see all of it.
                          onPaste={(e) => {
                            const pasted = e.clipboardData?.getData("text") || ""
                            if (pasted.includes("\n")) setExpandedDescs(prev => ({ ...prev, [i]: true }))
                          }}
                          placeholder="e.g. Video production"
                          className={s.lineInput}
                          autoCapitalize="sentences"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedDescs(prev => ({ ...prev, [i]: !prev[i] }))}
                        className={s.lineDescExpandBtn}
                        aria-label={expandedDescs[i] ? "Collapse description" : "Expand description for more detail"}
                        title={expandedDescs[i] ? "Collapse" : "More space"}
                      >{expandedDescs[i] ? "−" : "↕"}</button>
                    </div>
                  </div>
                  <div className={isMobile ? s.mobileAmountRow : undefined}>
                    <div className={isMobile ? s.mobileFlexItem : undefined}>
                      {isMobile && <span className={s.colLabel}>Amount (£)</span>}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={li.amount}
                        // Strip currency symbols / commas / spaces on input so users can
                        // paste "£1,200.50" straight from an email into the field.
                        onChange={(e) => updateLineItem(i, "amount", e.target.value.replace(/[£$€,\s]/g, ""))}
                        placeholder="0.00"
                        className={lineItemErrors[i] ? s.amountInputError : s.amountInput}
                      />
                    </div>
                    {isVatRegistered && (
                      <div className={isMobile ? s.mobileFlexItem : undefined}>
                        {isMobile && <span className={s.colLabel}>VAT Rate</span>}
                        <select
                          value={li.vatRate || "20"}
                          onChange={(e) => updateLineItem(i, "vatRate", e.target.value)}
                          className={s.vatSelect}
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
                      className={s.removeLineBtn}
                      aria-label="Remove line"
                    >×</button>
                  </div>
                  {lineItemErrors[i] && (
                    <div className={s.lineError}>{lineItemErrors[i]}</div>
                  )}
                </div>
              ))}
              <button type="button" onClick={addLineItem} className={s.addLineBtn}>+ Add line</button>
              {parsedTotal > 0 && (
                <div className={s.totalsWrap}>
                  {isVatRegistered && totalVat > 0 && (
                    <>
                      <div className={s.totalRow}>
                        <span>Subtotal (ex. VAT)</span>
                        <span className={s.mono}>{fmt(parsedTotal)}</span>
                      </div>
                      {Object.entries(vatBreakdown).filter(([, v]) => v > 0).map(([rate, amount]) => (
                        <div key={rate} className={s.totalRow}>
                          <span>VAT @ {rate}%</span>
                          <span className={s.mono}>{fmt(amount)}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className={s.grandTotalRow}>
                    <span className={s.grandTotalLabel}>{isVatRegistered && totalVat > 0 ? "Total (inc. VAT)" : "Total"}</span>
                    <span className={s.grandTotalValue}>{fmt(isVatRegistered ? totalWithVat : parsedTotal)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className={s.summaryBox}>
              <div className={s.summaryRow}>
                <span className={s.summaryLabel}>Ref</span>
                <span className={s.summaryRef}>{ref}</span>
              </div>
              <div className={s.summaryRowMt}>
                <span className={s.summaryLabel}>Due</span>
                <span className={`${s.dueValue} ${due < new Date(todayStr()) ? s.dueOverdue : s.dueNormal}`}>{formatDate(due)}</span>
              </div>
              {due < new Date(todayStr()) && (
                <div className={s.pastDueWarning}>
                  <strong>Heads up:</strong> This due date is in the past. The invoice will be created as <strong>overdue</strong> and chasing will begin immediately.
                </div>
              )}
              {parsedTotal > 0 && !noFines && (
                <div className={s.penaltyRow}>
                  <span>Late penalty</span>
                  <span>{fmt(p)} + {getRate()}% p.a.</span>
                </div>
              )}
              {parsedTotal > 0 && noFines && (
                <div className={s.penaltyRow}>
                  <span>Late penalty</span>
                  <span className={s.waived}>Waived</span>
                </div>
              )}
            </div>
          </Card>

          {/* What Hielda does with this invoice — first-class switches.
              These controls lived in collapsed accordions and users
              couldn't find them; the detailed configuration (intro text,
              send method) still lives in the accordions below. */}
          <div className={s.introFullWidth}>
            <div className={s.willCard}>
              <div className={s.willTitle}>Hielda will…</div>
              {[
                {
                  key: "intro",
                  on: sendIntro,
                  toggle: () => setSendIntro(v => !v),
                  label: "Email the invoice to your client",
                  sub: sendIntro ? "An introduction + the invoice PDF, sent when you create it" : "Off — you'll send the invoice yourself",
                },
                {
                  key: "chase",
                  on: autoChase,
                  toggle: () => setAutoChase(v => !v),
                  label: "Chase it if unpaid",
                  sub: autoChase ? "Escalating reminders — Hielda always checks with you before emailing your client" : "Off — no reminders or chase emails for this invoice",
                },
                ...(clientType !== "consumer" ? [{
                  key: "fines",
                  on: !noFines,
                  toggle: () => setNoFines(v => !v),
                  label: "Add fines & interest when late",
                  sub: !noFines ? `Statutory ${getRate()}% p.a. + £${penalty(parsedTotal || 0)} fixed recovery cost, from day one overdue` : "Off — chasing stays informal, no charges added",
                }] : []),
              ].map(row => (
                <div key={row.key} className={s.willRow}>
                  <div className={s.willRowText}>
                    <div className={s.willRowLabel}>{row.label}</div>
                    <div className={s.willRowSub}>{row.sub}</div>
                  </div>
                  <button
                    type="button"
                    onClick={row.toggle}
                    className={s.willSwitch}
                    style={{ background: row.on ? "var(--ac)" : "var(--bd)" }}
                    role="switch"
                    aria-checked={row.on}
                    aria-label={row.label}
                  >
                    <div className={s.willSwitchThumb} style={{ left: row.on ? 21 : 3 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Primary CTA — for a standard invoice, users tap this without
              ever opening the accordions below. */}
          <div className={s.step1Footer}>
            {isEditing
              ? <Btn dis={!canProceed || saving} onClick={saveEdit}>{saving ? "Saving..." : "Save Changes"}</Btn>
              : (
                <>
                  <Btn dis={!canProceed} onClick={() => setStep(2)}>Review →</Btn>
                  {hasContent && (
                    <Btn v="ghost" sz="sm" onClick={saveDraftAndLeave}>Save & finish later</Btn>
                  )}
                </>
              )
            }
          </div>

          {/* Optional: address + recipient options (collapsed by default) */}
          <div className={s.introFullWidth}>
            <CollapsibleSection
              title="Address & recipients"
              description="Client address, CC, BCC, and client type"
            >
              <Inp label="Address" value={ca} onChange={setCa} ph="Full address" ta
                autoComplete="street-address" autoCapitalize="sentences" rows={4} />
              <Inp label="CC (optional)" value={cc} onChange={(v) => { setCc(v); setCcAutoFilled(false) }} ph="sarah@company.com, boss@company.com"
                inputMode="email" autoCapitalize="none" spellCheck={false}
                error={cc.trim() && cc.split(",").some(e => e.trim() && !isValidEmail(e.trim())) ? "One or more CC emails are invalid" : ""} />
              {/* Live confirmation so users know the CC "took" — there's no
                  save button here on purpose (it saves as you type), but
                  without feedback that's impossible to tell. */}
              {cc.trim() && cc.split(",").every(e => !e.trim() || isValidEmail(e.trim())) && (
                <p className={s.ccConfirm}>
                  <Check size={12} strokeWidth={3} /> Will be CC'd on every email for this invoice: {cc.split(",").map(e => e.trim()).filter(Boolean).join(", ")}
                </p>
              )}
              <Inp label="BCC (optional)" value={bcc} onChange={setBcc} ph="accountant@mine.com"
                inputMode="email" autoCapitalize="none" spellCheck={false}
                error={bcc.trim() && bcc.split(",").some(e => e.trim() && !isValidEmail(e.trim())) ? "One or more BCC emails are invalid" : ""} />
              {bcc.trim() && bcc.split(",").every(e => !e.trim() || isValidEmail(e.trim())) && (
                <p className={s.ccConfirm}>
                  <Check size={12} strokeWidth={3} /> Will be BCC'd: {bcc.split(",").map(e => e.trim()).filter(Boolean).join(", ")}
                </p>
              )}
              <p className={s.ccHint}>
                Separate multiple emails with a comma — they're saved with the invoice automatically, no save button needed. CC is also remembered for the next invoice to this client. You'll always be BCC'd yourself (your client won't see you on the recipient list).
              </p>

              <div className={s.clientTypeWrap}>
                <label className={s.fieldLabel}>Client type</label>
                <div className={s.toggleRow}>
                  {[{ v: "business", l: "Business (B2B)" }, { v: "consumer", l: "Consumer (individual)" }].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setClientType(opt.v)}
                      className={clientType === opt.v ? s.toggleBtnActive : s.toggleBtn}
                    >{opt.l}</button>
                  ))}
                </div>
                {clientType === "consumer" && (
                  <p className={s.consumerNote}>
                    Payment terms will be added to the invoice (contractual interest at {getRate()}% p.a. if overdue). No statutory fixed debt recovery cost applies to consumer invoices.
                  </p>
                )}
              </div>
            </CollapsibleSection>
          </div>

          {/* Optional: invoice details (collapsed by default) */}
          <div className={s.introFullWidth}>
            <CollapsibleSection
              title="Invoice details"
              description="Invoice number, notes, dates, payment terms"
            >
              <Inp label="Invoice number" value={ref} onChange={setRef} ph="e.g. INV-0001"
                autoCapitalize="characters" spellCheck={false} autoComplete="off"
                error={!ref.trim() ? "Invoice number is required" : ""} />
              <Inp label="Client reference / PO number (optional)" value={clientRef} onChange={setClientRef} ph="e.g. PO-4821"
                autoCapitalize="characters" spellCheck={false} autoComplete="off" />
              <Inp label="Notes (optional)" value={notes} onChange={setNotes} ta rows={3}
                ph="Anything else to include on the invoice — payment instructions, project name, references, etc."
                autoCapitalize="sentences" />
              <Sel label="Payment Terms" value={terms} onChange={(v) => { setTerms(v); if (v !== "-1") setCustomDays(""); }} opts={TERMS.map((t) => ({ l: t.l, v: String(t.d) }))} />
              {terms === "-1" && (
                <Inp label="Custom Days" value={customDays} onChange={setCustomDays} ph="e.g. 21" type="text" inputMode="numeric" mono error={customDaysError} />
              )}
              <Inp label="Issue Date" value={date} onChange={setDate} type="date" />

              <div className={clientType === "consumer" ? s.noFinesRowHidden : s.noFinesRow}>
                <input type="checkbox" id="noFines" checked={noFines} onChange={(e) => setNoFines(e.target.checked)} className={s.checkbox} />
                <label htmlFor="noFines" className={s.checkboxLabel}>Chase without fines or interest</label>
                <button
                  type="button"
                  onClick={() => setShowNoFinesInfo(v => !v)}
                  className={showNoFinesInfo ? s.infoBtnActive : s.infoBtn}
                  aria-label="About this option"
                >?</button>
              </div>
              {showNoFinesInfo && (
                <div className={s.infoBox}>
                  Hielda will still chase this invoice on your behalf and send all the usual reminder and chase emails — but the emails won't reference any additional fines or interest on top of the original invoice amount. Useful if you'd prefer to keep things informal with a particular client.
                </div>
              )}
              {noFines && !showNoFinesInfo && (
                <div className={s.noFinesHint}>We'll still send chase emails, but won't add statutory penalties or interest.</div>
              )}
            </CollapsibleSection>
          </div>

          {/* Optional: email message to client (collapsed by default) */}
          <div className={s.introFullWidth}>
            <CollapsibleSection
              title="Email message to client"
              description={sendIntro ? "On — Hielda will email an introduction with this invoice" : "Off — no introduction email will be sent"}
            >
              <div className={s.introCheckRow}>
                <input
                  type="checkbox"
                  id="sendIntro"
                  checked={sendIntro}
                  onChange={(e) => setSendIntro(e.target.checked)}
                  className={s.introCheckbox}
                />
                <div className={s.introCheckContent}>
                  <div className={s.introLabelRow}>
                    <label htmlFor="sendIntro" className={s.introLabel}>
                      Send {cn || "this client"} a friendly introduction to Hielda
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowIntroInfo(v => !v)}
                      className={showIntroInfo ? s.infoBtnActive : s.infoBtn}
                      aria-label="About this feature"
                    >?</button>
                  </div>
                  <span className={s.introSubtext}>
                    For existing clients you now want to manage through Hielda.
                  </span>
                  {showIntroInfo && (
                    <div className={s.infoBoxMarginTop}>
                      <strong className={s.introInfoBold}>What this does:</strong> Sends a professional, friendly email to your client explaining that you've started using Hielda to manage your invoicing. It reassures them that nothing changes on their end — they'll still receive invoices and reminders as normal. This is especially useful for long-standing clients who might be surprised to receive emails from Hielda.
                    </div>
                  )}
                </div>
              </div>

              {sendIntro && (
                <div className={s.introEditWrap}>
                  <div className={s.sectionLabel}>Hielda will send the message below — edit if you want to</div>
                  <textarea
                    value={introText}
                    onChange={(e) => { setIntroText(e.target.value); setIntroTextEdited(true) }}
                    className={s.introEditTextarea}
                  />
                  <div className={s.introMethodRow}>
                    <button
                      onClick={() => setIntroMethod("hielda")}
                      className={introMethod === "hielda" ? s.methodBtnActive : s.methodBtn}
                    >📧 Hielda sends it for me</button>
                    <button
                      onClick={() => setIntroMethod("self")}
                      className={introMethod === "self" ? s.methodBtnActive : s.methodBtn}
                    >✍️ I'll send it myself</button>
                  </div>
                  {introMethod === "self" && (
                    <div className={s.introSelfNote}>We'll show you this text to copy after the invoice is created.</div>
                  )}
                </div>
              )}
            </CollapsibleSection>
          </div>

          <div className={s.step1Footer}>
            {isEditing
              ? <Btn dis={!canProceed || saving} onClick={saveEdit}>{saving ? "Saving..." : "Save Changes"}</Btn>
              : (
                <>
                  <Btn dis={!canProceed} onClick={() => setStep(2)}>Review →</Btn>
                  {hasContent && (
                    <Btn v="ghost" sz="sm" onClick={saveDraftAndLeave}>Save & finish later</Btn>
                  )}
                </>
              )
            }
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          {due < new Date(todayStr()) && (
            <div className={s.overdueWarning}>
              ⚠️ <strong>This invoice is already overdue.</strong> Hielda will begin chasing immediately after creation.
            </div>
          )}
          <Card style={{ marginBottom: 16, background: "#fff", borderRadius: 12 }}>
            <div className={s.invoiceHead}>
              <div className={s.invoiceHeadFlex}>
                <div>
                  <div className={s.invoiceTag}>INVOICE</div>
                  <div className={s.invoiceRef}>{ref}</div>
                </div>
                <div className={s.invoiceSender}>
                  <div className={s.senderName}>{profile?.business_name || profile?.full_name || ""}</div>
                  <div className={s.senderAddr}>{profile?.address || ""}</div>
                </div>
              </div>
            </div>
            <div className={s.invoiceBody}>
              <div className={s.invoiceGrid}>
                <div>
                  <div className={s.billToLabel}>Bill To</div>
                  <div className={s.billToName}>{cn}</div>
                  <div className={s.billToAddr}>{ca}</div>
                </div>
                <div className={s.invoiceMeta}>
                  <div>Issue: {formatDate(date)}</div>
                  <div>Due: {formatDate(due)}</div>
                  <div>Terms: {effectiveDays} days</div>
                </div>
              </div>
              <div className={s.lineItemsTable}>
                <div className={s.tableHeader}>
                  <span>Description</span><span>Amount</span>
                </div>
                {lineItems.filter(li => li.description || li.amount).map((li, i) => (
                  <div key={i} className={i > 0 ? s.tableRowBorder : s.tableRow}>
                    <span className={s.rowDesc}>{li.description || <em className={s.rowNoDesc}>No description</em>}</span>
                    <span className={s.mono}>{fmt(parseFloat(li.amount) || 0)}</span>
                  </div>
                ))}
              </div>
              {isVatRegistered && totalVat > 0 && (
                <div className={s.vatSection}>
                  <div className={s.vatRow}>
                    <span>Subtotal (ex. VAT)</span>
                    <span className={s.mono}>{fmt(parsedTotal)}</span>
                  </div>
                  {Object.entries(vatBreakdown).filter(([, v]) => v > 0).map(([rate, amount]) => (
                    <div key={rate} className={s.vatRow}>
                      <span>VAT @ {rate}%</span>
                      <span className={s.mono}>+{fmt(amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className={s.invoiceTotalRow} style={{ marginTop: isVatRegistered && totalVat > 0 ? 6 : 12 }}>
                <span className={s.invoiceTotalLabel}>
                  {isVatRegistered && totalVat > 0 ? "Total (inc. VAT)" : "Total Due"}
                </span>
                <span className={s.invoiceTotalValue}>
                  {fmt(isVatRegistered ? totalWithVat : parsedTotal)}
                </span>
              </div>
              <div className={s.paymentDetailsBox}>
                <div className={s.paymentDetailsTitle}>Payment Details</div>
                <div>Sort Code: {profile?.sort_code || "—"} · Account: {profile?.account_number || "—"} · Ref: {ref}</div>
              </div>
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <div className={s.introCheckRow}>
              <input
                type="checkbox"
                id="sendDownload"
                checked={meth === "download"}
                onChange={(e) => setMeth(e.target.checked ? "download" : "portal")}
                className={s.introCheckbox}
              />
              <div className={s.introCheckContent}>
                <label htmlFor="sendDownload" className={s.introLabel}>
                  I'll send the PDF to {cn || "the client"} myself
                </label>
                <span className={s.introSubtext}>
                  By default Hielda emails the invoice for you and chases automatically. Tick this if you'd rather download the PDF and send it yourself — Hielda will still chase if it goes unpaid.
                </span>
              </div>
            </div>
          </Card>

          <div className={s.step2Footer}>
            <Btn v="ghost" onClick={() => setStep(1)}>← Back</Btn>
            <Btn dis={saving} onClick={go}>
              {saving
                ? "Creating..."
                : meth === "download"
                  ? "📥 Create & Download"
                  : `📧 Send to ${cn || "client"}`}
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
