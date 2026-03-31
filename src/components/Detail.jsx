import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import { colors as c, MONO, CHASE_STAGES, FONT, getRate, getDailyRate } from "../constants"
import { daysLate, calcInterest, penalty, fmt, formatDate, addDays } from "../utils"
import { Card, Badge, Btn, ErrorBanner } from "./ui"
import { buildChaseEmail } from "../lib/emailTemplates"
import { trackEvent } from "../posthog"

const STAGE_ORDER = ["reminder_1", "reminder_2", "final_warning", "first_chase", "second_chase", "third_chase", "chase_4", "chase_5", "chase_6", "chase_7", "chase_8", "chase_9", "chase_10", "chase_11", "escalation_1", "escalation_2", "escalation_3", "escalation_4", "final_notice"]

function getNextStage(currentStage) {
  if (!currentStage) return "reminder_1"
  const idx = STAGE_ORDER.indexOf(currentStage)
  if (idx === -1) return "reminder_1"
  if (idx >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

function getStageToBeSent(invoice) {
  if (!invoice.chase_stage) return "reminder_1"
  return invoice.chase_stage
}

function getStageLabel(stageId) {
  const stage = CHASE_STAGES.find((s) => s.id === stageId)
  return stage ? stage.label : stageId
}

const TIMELINE_GROUPS = [
  {
    label: "Friendly Reminders",
    desc: "Polite check-ins before the due date",
    col: "#1e5fa0",
    stages: ["reminder_1", "reminder_2"],
  },
  {
    label: "Due Date Warning",
    desc: "Last chance to pay at the original amount",
    col: "#b45309",
    stages: ["final_warning"],
  },
  {
    label: "Overdue — Fines Applied",
    desc: "Statutory interest and penalties now accruing",
    col: "#d97706",
    stages: ["first_chase", "second_chase", "third_chase"],
  },
  {
    label: "Persistent Chasing",
    desc: "Every 2 days — amount growing with each notice",
    col: "#9f1239",
    stages: ["chase_4", "chase_5", "chase_6", "chase_7", "chase_8", "chase_9", "chase_10", "chase_11"],
  },
  {
    label: "Daily Escalation",
    desc: "Countdown to formal recovery — one email per day",
    col: "#7f1d1d",
    stages: ["escalation_1", "escalation_2", "escalation_3", "escalation_4", "final_notice"],
  },
]

function ChaseTimeline({ inv, si }) {
  const [expanded, setExpanded] = useState({})

  const toggle = (label) => setExpanded((prev) => ({ ...prev, [label]: !prev[label] }))

  const currentGroup = TIMELINE_GROUPS.find((g) => g.stages.includes(inv.chase_stage))

  return (
    <Card>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Chase Timeline</h3>
      <p style={{ fontSize: 11, color: c.td, marginBottom: 14 }}>We check in with you before every step. Click a section to see details.</p>
      {TIMELINE_GROUPS.map((group) => {
        const groupStages = CHASE_STAGES.filter((s) => group.stages.includes(s.id))
        const isCurrentGroup = currentGroup?.label === group.label
        const isOpen = expanded[group.label] ?? isCurrentGroup
        const allPast = groupStages.every((s) => si >= 0 && CHASE_STAGES.indexOf(s) <= si)
        const somePast = groupStages.some((s) => si >= 0 && CHASE_STAGES.indexOf(s) <= si)
        const firstStage = groupStages[0]
        const lastStage = groupStages[groupStages.length - 1]
        const dateRange = firstStage.dfd === lastStage.dfd
          ? formatDate(addDays(inv.due_date, firstStage.dfd))
          : `${formatDate(addDays(inv.due_date, firstStage.dfd))} — ${formatDate(addDays(inv.due_date, lastStage.dfd))}`

        return (
          <div key={group.label} style={{ marginBottom: 8 }}>
            <button
              onClick={() => toggle(group.label)}
              style={{
                width: "100%", textAlign: "left", background: allPast ? "rgba(22,163,74,0.05)" : somePast ? "rgba(30,95,160,0.05)" : c.bg,
                border: `1px solid ${allPast ? "rgba(22,163,74,0.15)" : somePast ? "rgba(30,95,160,0.15)" : c.bd}`,
                borderRadius: 8, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                background: allPast ? c.gn : somePast ? group.col : c.bg,
                border: `2px solid ${allPast ? c.gn : somePast ? group.col : c.bd}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: allPast || somePast ? c.w : c.td,
              }}>
                {allPast ? "✓" : somePast ? "•" : ""}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: allPast ? c.gn : somePast ? c.tx : c.td, fontSize: 12 }}>{group.label}</span>
                  {isCurrentGroup && <Badge color={group.col}>Active</Badge>}
                  <span style={{ fontSize: 10, color: c.td, marginLeft: "auto" }}>{groupStages.length} {groupStages.length === 1 ? "email" : "emails"}</span>
                </div>
                <div style={{ fontSize: 10, color: c.td, marginTop: 2 }}>{dateRange}</div>
              </div>
              <span style={{ fontSize: 11, color: c.td, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>▼</span>
            </button>

            {isOpen && (
              <div style={{ paddingLeft: 20, borderLeft: `2px solid ${group.col}20`, marginLeft: 12, marginTop: 6 }}>
                <p style={{ fontSize: 10, color: c.tm, margin: "0 0 8px", fontStyle: "italic" }}>{group.desc}</p>
                {groupStages.map((stg) => {
                  const act = stg.id === inv.chase_stage
                  const past = si >= 0 && CHASE_STAGES.indexOf(stg) <= si
                  return (
                    <div key={stg.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: `1px solid ${c.bdl}` }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                        background: past ? stg.col : "transparent",
                        border: `2px solid ${past ? stg.col : c.bd}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 8, color: past ? c.w : c.td,
                      }}>
                        {past ? "✓" : ""}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: act ? 700 : 400, color: past ? c.tx : c.td, flex: 1 }}>{stg.label}</span>
                      {act && <Badge color={stg.col}>Next</Badge>}
                      <span style={{ fontSize: 10, color: c.td, fontFamily: MONO, flexShrink: 0 }}>
                        {stg.dfd < 0 ? `${Math.abs(stg.dfd)}d before` : stg.dfd === 0 ? "Due date" : `+${stg.dfd}d`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}

export default function Detail({ inv, nav, profile, onUpdate, isMobile }) {
  const [marking, setMarking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [downloading, setDownloading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState(null)
  const [chaseLogs, setChaseLogs] = useState([])
  const [autoChase, setAutoChase] = useState(inv?.auto_chase !== false)
  const [noFines, setNoFines] = useState(inv?.no_fines || false)
  const [ccEmails, setCcEmails] = useState(inv?.cc_emails || "")
  const [bccEmails, setBccEmails] = useState(inv?.bcc_emails || "")
  const [savingRecipients, setSavingRecipients] = useState(false)
  const [showFinesInfo, setShowFinesInfo] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState("")
  const [editingClient, setEditingClient] = useState(false)
  const [clientEdit, setClientEdit] = useState({ name: "", email: "", address: "", ref: "" })
  const [savingClient, setSavingClient] = useState(false)
  const [emailChanged, setEmailChanged] = useState(false)
  const [resending, setResending] = useState(false)
  const [showPartialPayment, setShowPartialPayment] = useState(false)
  const [partialAmount, setPartialAmount] = useState("")
  const [savingPartial, setSavingPartial] = useState(false)
  const [disputing, setDisputing] = useState(false)

  useEffect(() => {
    if (!inv?.id) return
    setAutoChase(inv.auto_chase !== false)
    setNoFines(inv.no_fines || false)
    supabase
      .from("chase_log")
      .select("*")
      .eq("invoice_id", inv.id)
      .order("sent_at", { ascending: false })
      .then(({ data }) => {
        if (data) setChaseLogs(data)
      })
  }, [inv?.id, inv?.auto_chase])

  if (!inv) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.tx, marginBottom: 4 }}>Invoice not found</div>
        <div style={{ fontSize: 13, color: c.tm, marginBottom: 16 }}>This invoice may have been deleted.</div>
        <Btn onClick={() => nav("dash")}>Back to Dashboard</Btn>
      </div>
    )
  }

  const dl = daysLate(inv.due_date)
  const ov = inv.status === "overdue"
  const isDisputed = inv.status === "disputed"
  const isConsumer = inv.client_type === "consumer"
  const finesEnabled = !inv.no_fines && !isConsumer
  const netAmount = Number(inv.amount)
  const vatAmount = Number(inv.vat_amount) || 0
  const invoiceTotal = Number(inv.total_with_vat) || netAmount
  const hasVat = vatAmount > 0
  const interest = ov && finesEnabled ? calcInterest(netAmount, dl) : 0
  const pen = ov && finesEnabled ? penalty(netAmount) : 0
  const ex = interest + pen
  const tot = invoiceTotal + ex
  const si = CHASE_STAGES.findIndex((s) => s.id === inv.chase_stage)

  // VAT breakdown from line items
  const vatBreakdown = hasVat && inv.line_items ? inv.line_items.reduce((acc, li) => {
    const amt = parseFloat(li.amount) || 0
    const rate = li.vatRate || "0"
    if (rate === "exempt" || rate === "0") return acc
    const rateNum = parseFloat(rate) || 0
    acc[rate] = (acc[rate] || 0) + Math.round(amt * rateNum / 100 * 100) / 100
    return acc
  }, {}) : {}

  const downloadPdf = async () => {
    setDownloading(true)
    setError("")
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-invoice-pdf", {
        body: { invoice_id: inv.id },
      })
      if (fnErr) throw fnErr
      const blob = new Blob([data], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${inv.ref}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      trackEvent("pdf_downloaded", { ref: inv.ref })
    } catch (e) {
      setError("PDF generation failed: " + e.message)
    }
    setDownloading(false)
  }

  const currentSendStage = getStageToBeSent(inv)

  const showEmailPreview = () => {
    const email = buildChaseEmail(inv, profile, currentSendStage)
    if (email) setPreviewHtml(email.html)
  }

  const deleteInvoice = async () => {
    if (!window.confirm(`Permanently delete invoice ${inv.ref}? This cannot be undone.`)) return
    setDeleting(true)
    setError("")
    try {
      const { error: err } = await supabase.from("invoices").delete().eq("id", inv.id)
      if (err) throw err
      onUpdate()
      nav("dash")
    } catch (e) {
      setError("Failed to delete: " + e.message)
    }
    setDeleting(false)
  }

  const markPaid = async () => {
    setMarking(true)
    setError("")
    try {
      const { error: err } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_date: new Date().toISOString().split("T")[0], chase_stage: null })
        .eq("id", inv.id)
      if (err) throw err
      trackEvent("invoice_paid", { amount: Number(inv.amount), ref: inv.ref })
      onUpdate()
      nav("dash")
    } catch (e) {
      setError("Failed to mark as paid: " + e.message)
    }
    setMarking(false)
  }

  const sendChaseEmail = async () => {
    const stage = currentSendStage
    const stageLabel = getStageLabel(stage)

    const ccList = ccEmails.trim() ? `, CC: ${ccEmails.trim()}` : ""
    const confirmed = window.confirm(
      `Send ${stageLabel} email to ${inv.client_email}${ccList}?\n\nYou'll also be CC'd automatically.`
    )
    if (!confirmed) return

    setSending(true)
    setError("")
    setSendSuccess("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userToken = session?.access_token

      const res = await fetch("/api/send-chase-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: inv.id,
          chase_stage: stage,
          user_token: userToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")
      setSendSuccess(`${stageLabel} email sent to ${data.email_to}`)
      trackEvent("chase_sent", { stage, ref: inv.ref })

      // Server handles chase_stage advancement — just refresh
      const { data: logs } = await supabase
        .from("chase_log")
        .select("*")
        .eq("invoice_id", inv.id)
        .order("sent_at", { ascending: false })
      if (logs) setChaseLogs(logs)
      onUpdate()
      setTimeout(() => setSendSuccess(""), 5000)
    } catch (e) {
      setError("Failed to send chase email: " + e.message)
    }
    setSending(false)
  }

  const toggleAutoChase = async () => {
    const newVal = !autoChase
    if (!newVal && !window.confirm("Pause automatic chasing for this invoice? You can resume it at any time.")) return
    setAutoChase(newVal)
    try {
      const { error: err } = await supabase
        .from("invoices")
        .update({ auto_chase: newVal })
        .eq("id", inv.id)
      if (err) throw err
      onUpdate()
    } catch (e) {
      setAutoChase(!newVal)
      setError("Failed to update auto-chase: " + e.message)
    }
  }

  const toggleNoFines = async () => {
    const newVal = !noFines
    setNoFines(newVal)
    try {
      const { error: err } = await supabase
        .from("invoices")
        .update({ no_fines: newVal })
        .eq("id", inv.id)
      if (err) throw err
      onUpdate()
    } catch (e) {
      setNoFines(!newVal)
      setError("Failed to update fines setting: " + e.message)
    }
  }

  const startEditClient = () => {
    setClientEdit({
      name: inv.client_name || "",
      email: inv.client_email || "",
      address: inv.client_address || "",
      ref: inv.client_ref || "",
    })
    setEditingClient(true)
  }

  const saveClientDetails = async () => {
    setSavingClient(true)
    setError("")
    try {
      const emailHasChanged = clientEdit.email.trim().toLowerCase() !== (inv.client_email || "").toLowerCase()
      const { error: err } = await supabase
        .from("invoices")
        .update({
          client_name: clientEdit.name.trim(),
          client_email: clientEdit.email.trim(),
          client_address: clientEdit.address.trim() || null,
          client_ref: clientEdit.ref.trim() || null,
        })
        .eq("id", inv.id)
      if (err) throw err
      setEditingClient(false)
      setEmailChanged(emailHasChanged && chaseLogs.length > 0)
      onUpdate()
    } catch (e) {
      setError("Failed to save: " + e.message)
    }
    setSavingClient(false)
  }

  const resendEmail = async (stage, resetChase) => {
    setResending(true)
    setError("")
    try {
      // If restarting from day 1, reset the chase_stage on the invoice first
      if (resetChase) {
        const { error: resetErr } = await supabase
          .from("invoices")
          .update({ chase_stage: "reminder_1" })
          .eq("id", inv.id)
        if (resetErr) throw resetErr
      }

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/send-chase-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: inv.id, chase_stage: stage, user_token: session?.access_token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")
      setEmailChanged(false)

      if (resetChase) {
        // Advance to reminder_2 after sending reminder_1
        await supabase.from("invoices").update({ chase_stage: "reminder_2" }).eq("id", inv.id)
        setSendSuccess(`Chase restarted — sent ${getStageLabel(stage)} to ${data.email_to}`)
      } else {
        setSendSuccess(`Resent ${getStageLabel(stage)} to ${data.email_to}`)
      }

      const { data: logs } = await supabase.from("chase_log").select("*").eq("invoice_id", inv.id).order("sent_at", { ascending: false })
      if (logs) setChaseLogs(logs)
      onUpdate()
      setTimeout(() => setSendSuccess(""), 5000)
    } catch (e) {
      setError("Failed to resend: " + e.message)
    }
    setResending(false)
  }

  const recordPartialPayment = async () => {
    const amount = parseFloat(partialAmount)
    if (!amount || amount <= 0) return
    setSavingPartial(true)
    setError("")
    try {
      const newPaid = Math.round(((Number(inv.amount_paid) || 0) + amount) * 100) / 100
      const fullyPaid = newPaid >= Number(inv.amount)
      const updates = { amount_paid: newPaid }
      if (fullyPaid) {
        updates.status = "paid"
        updates.paid_date = new Date().toISOString().split("T")[0]
        updates.chase_stage = null
      }
      const { error: err } = await supabase.from("invoices").update(updates).eq("id", inv.id)
      if (err) throw err
      setShowPartialPayment(false)
      setPartialAmount("")
      setSendSuccess(fullyPaid ? "Invoice fully paid!" : `Recorded ${fmt(amount)} partial payment`)
      onUpdate()
      setTimeout(() => setSendSuccess(""), 5000)
    } catch (e) {
      setError("Failed to record payment: " + e.message)
    }
    setSavingPartial(false)
  }

  const markDisputed = async () => {
    if (!window.confirm(`Mark this invoice as disputed?\n\nChasing will be paused while you resolve this. You can resume at any time.`)) return
    setDisputing(true)
    setError("")
    try {
      const { error: err } = await supabase
        .from("invoices")
        .update({ status: "disputed", auto_chase: false })
        .eq("id", inv.id)
      if (err) throw err
      onUpdate()
    } catch (e) {
      setError("Failed to mark as disputed: " + e.message)
    }
    setDisputing(false)
  }

  const clearDispute = async () => {
    setDisputing(true)
    setError("")
    try {
      const resumeStatus = new Date(inv.due_date) < new Date() ? "overdue" : "pending"
      const { error: err } = await supabase
        .from("invoices")
        .update({ status: resumeStatus, auto_chase: true })
        .eq("id", inv.id)
      if (err) throw err
      onUpdate()
    } catch (e) {
      setError("Failed to resolve dispute: " + e.message)
    }
    setDisputing(false)
  }

  const amountPaid = Number(inv.amount_paid) || 0
  const amountRemaining = Math.round((Number(inv.amount) - amountPaid) * 100) / 100

  return (
    <div>
      <button onClick={() => nav("dash")} style={{ background: "none", border: "none", color: c.tm, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 18 }}>
        ← Back to Dashboard
      </button>

      {/* Header: title + badges */}
      <div style={{ marginBottom: isMobile ? 14 : 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: isMobile ? 18 : 21, fontWeight: 700, color: c.tx, margin: 0 }}>{inv.ref}</h1>
          <Badge color={inv.status === "paid" ? c.gn : ov ? c.or : isDisputed ? "#7c3aed" : c.am}>
            {ov ? "being chased" : isDisputed ? "disputed" : inv.status}
          </Badge>
          {isConsumer && <Badge color={c.am}>consumer</Badge>}
          {!isConsumer && inv.no_fines && <Badge color={c.td}>no fines</Badge>}
        </div>
        <p style={{ color: c.tm, margin: 0, fontSize: 13 }}>{inv.client_name} · {inv.description}</p>
      </div>

      {/* Action buttons — responsive */}
      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: isMobile ? 14 : 22,
        flexWrap: "wrap",
      }}>
        {inv.status !== "paid" && (
          <Btn v="successAction" onClick={markPaid} dis={marking} sz={isMobile ? "sm" : undefined}>
            {marking ? "..." : "✓ Paid"}
          </Btn>
        )}
        {inv.status !== "paid" && (
          <Btn v="ghost" onClick={() => setShowPartialPayment(v => !v)} sz="sm">
            💰 Part Paid
          </Btn>
        )}
        <Btn v="ghost" onClick={() => {
          try { localStorage.setItem("hielda_clone", JSON.stringify({
            cn: inv.client_name, ce: inv.client_email, ca: inv.client_address || "",
            lineItems: inv.line_items?.length ? inv.line_items : [{ description: inv.description || "", amount: String(inv.amount) }],
            clientRef: inv.client_ref || "", cc: inv.cc_emails || "", bcc: inv.bcc_emails || "",
            terms: String(inv.payment_term_days || 30), noFines: inv.no_fines || false,
          })) } catch {}
          nav("create")
        }} sz="sm">
          📋 Clone
        </Btn>
        <Btn v="ghost" onClick={downloadPdf} dis={downloading} sz="sm">
          {downloading ? "..." : "📥 PDF"}
        </Btn>
        {inv.status !== "paid" && inv.client_email && (
          <Btn v="ghost" onClick={showEmailPreview} sz="sm">
            📧 Preview
          </Btn>
        )}
        {inv.status !== "paid" && inv.client_email && (
          <Btn v="ghost" onClick={sendChaseEmail} dis={sending} sz="sm">
            {sending ? "..." : `📤 Send`}
          </Btn>
        )}
        {inv.status !== "paid" && !inv.client_email && (
          <div style={{ fontSize: 11, color: c.or, padding: "6px 10px", background: c.ord, borderRadius: 7, display: "flex", alignItems: "center", gap: 5 }}>
            ⚠ No client email — chase emails unavailable
          </div>
        )}
        {inv.status !== "paid" && !isDisputed && (
          <Btn v="ghost" onClick={markDisputed} dis={disputing} sz="sm" style={{ color: "#7c3aed", borderColor: "#7c3aed40" }}>
            ⚑ Dispute
          </Btn>
        )}
        {isDisputed && (
          <Btn v="ghost" onClick={clearDispute} dis={disputing} sz="sm" style={{ color: "#7c3aed", borderColor: "#7c3aed40" }}>
            {disputing ? "..." : "↩ Resolve Dispute"}
          </Btn>
        )}
        <Btn v="danger" onClick={deleteInvoice} dis={deleting} sz="sm">
          {deleting ? "..." : "🗑 Delete"}
        </Btn>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {isDisputed && (
        <div style={{
          padding: "14px 18px", background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)",
          borderLeft: "3px solid #7c3aed", borderRadius: "0 10px 10px 0", marginBottom: 16,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed", marginBottom: 3 }}>Invoice under dispute</div>
            <div style={{ fontSize: 12, color: c.tm, lineHeight: 1.5 }}>
              Chasing is paused while this is resolved. Click <strong>Resolve Dispute</strong> above to resume chasing, or <strong>✓ Paid</strong> if it has been settled.
            </div>
          </div>
        </div>
      )}

      {/* Partial payment form */}
      {showPartialPayment && inv.status !== "paid" && (
        <div style={{ padding: "14px 16px", background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.tx, marginBottom: 8 }}>Record a partial payment</div>
          {amountPaid > 0 && (
            <div style={{ fontSize: 11, color: c.tm, marginBottom: 8 }}>
              Already received: <strong>{fmt(amountPaid)}</strong> of {fmt(inv.amount)} · Remaining: <strong>{fmt(amountRemaining)}</strong>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              value={partialAmount}
              onChange={e => setPartialAmount(e.target.value)}
              placeholder={`Up to ${fmt(amountRemaining)}`}
              step="0.01"
              max={amountRemaining}
              style={{ flex: 1, maxWidth: 160, padding: "8px 10px", border: `1px solid ${c.bd}`, borderRadius: 7, fontFamily: MONO, fontSize: 12, color: c.tx, background: c.bg, outline: "none", boxSizing: "border-box" }}
            />
            <Btn sz="sm" onClick={recordPartialPayment} dis={savingPartial || !partialAmount || parseFloat(partialAmount) <= 0}>
              {savingPartial ? "..." : "Record"}
            </Btn>
            <button onClick={() => setShowPartialPayment(false)} style={{ background: "none", border: "none", color: c.td, cursor: "pointer", fontSize: 12, fontFamily: FONT }}>Cancel</button>
          </div>
          {parseFloat(partialAmount) >= amountRemaining && partialAmount && (
            <div style={{ fontSize: 11, color: c.gn, marginTop: 6 }}>This will mark the invoice as fully paid.</div>
          )}
        </div>
      )}

      {/* Partial payment progress */}
      {amountPaid > 0 && inv.status !== "paid" && (
        <div style={{ padding: "10px 14px", background: c.gnd, border: `1px solid ${c.gn}20`, borderRadius: 8, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: c.gn }}>Partial payment received</span>
            <span style={{ fontSize: 12, fontFamily: MONO, color: c.gn, fontWeight: 600 }}>{fmt(amountPaid)} / {fmt(inv.amount)}</span>
          </div>
          <div style={{ height: 6, background: `${c.gn}20`, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: c.gn, borderRadius: 3, width: `${Math.min(100, (amountPaid / Number(inv.amount)) * 100)}%`, transition: "width 0.3s" }} />
          </div>
          <div style={{ fontSize: 10, color: c.tm, marginTop: 4 }}>{fmt(amountRemaining)} still outstanding</div>
        </div>
      )}

      {sendSuccess && (
        <div style={{ padding: "10px 14px", background: c.gnd, color: c.gn, borderRadius: 8, fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span>✓</span> {sendSuccess}
        </div>
      )}

      {emailChanged && (
        <div style={{ padding: "14px 16px", background: "#fffbeb", border: "1px solid #f59e0b40", borderRadius: 10, fontSize: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 600, color: c.tx, marginBottom: 8 }}>📬 Client email updated</div>
          <div style={{ color: c.tm, marginBottom: 12, lineHeight: 1.5 }}>
            The new recipient hasn't received any previous emails. What would you like to do?
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn sz="sm" onClick={() => resendEmail("reminder_1", true)} dis={resending}>
              {resending ? "Sending…" : "Restart from day 1"}
            </Btn>
            {chaseLogs.length > 0 && (
              <Btn sz="sm" v="ghost" onClick={() => resendEmail(chaseLogs[0].chase_stage || chaseLogs[0].status, false)} dis={resending}>
                Resend last email only
              </Btn>
            )}
            <button onClick={() => setEmailChanged(false)} style={{ background: "none", border: "none", color: c.td, cursor: "pointer", fontSize: 12, fontFamily: FONT }}>Dismiss</button>
          </div>
        </div>
      )}

      {ov && ex > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "10px 14px" : "13px 18px",
          background: c.god, border: `1px solid rgba(161,98,7,0.15)`,
          borderLeft: "3px solid #d4a017", borderRadius: "0 12px 12px 0",
          marginBottom: isMobile ? 14 : 18,
          flexWrap: isMobile ? "wrap" : "nowrap", gap: 8,
        }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: c.go }}>Extra added by Hielda</span>
            <span style={{ fontSize: 12, color: c.tm, marginLeft: 8 }}>penalty + {dl}d interest</span>
          </div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: c.go, fontFamily: MONO }}>+{fmt(ex)}</div>
        </div>
      )}

      {/* Line items breakdown */}
      {inv.line_items?.length > 0 && (
        <Card style={{ marginBottom: isMobile ? 12 : 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Line Items</h3>
          <div style={{ display: "grid", gridTemplateColumns: hasVat ? "1fr auto auto" : "1fr auto", gap: 8, padding: "4px 0 6px", fontSize: 10, fontWeight: 600, color: c.td, textTransform: "uppercase" }}>
            <span>Description</span>
            {hasVat && <span style={{ textAlign: "right" }}>VAT</span>}
            <span style={{ textAlign: "right" }}>Amount</span>
          </div>
          {inv.line_items.map((li, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: hasVat ? "1fr auto auto" : "1fr auto", gap: 8, padding: "7px 0", borderTop: `1px solid ${c.bdl}` }}>
              <span style={{ color: c.tx, fontSize: 13 }}>{li.description}</span>
              {hasVat && <span style={{ color: c.td, fontSize: 12, textAlign: "right", minWidth: 50 }}>{li.vatRate === "exempt" ? "Exempt" : `${li.vatRate || 0}%`}</span>}
              <span style={{ color: c.tx, fontSize: 13, fontFamily: MONO, fontWeight: 500, textAlign: "right" }}>{fmt(li.amount)}</span>
            </div>
          ))}
          {hasVat ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", borderTop: `1px solid ${c.bd}`, marginTop: 2 }}>
                <span style={{ fontSize: 12, color: c.tm }}>Subtotal (ex. VAT)</span>
                <span style={{ fontSize: 13, fontFamily: MONO, color: c.tx }}>{fmt(netAmount)}</span>
              </div>
              {Object.entries(vatBreakdown).filter(([, v]) => v > 0).map(([rate, amount]) => (
                <div key={rate} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: 12, color: c.tm }}>VAT @ {rate}%</span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: c.tx }}>{fmt(amount)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", borderTop: `2px solid ${c.ac}33`, marginTop: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.tx }}>Total (inc. VAT)</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: c.ac, fontFamily: MONO }}>{fmt(invoiceTotal)}</span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", borderTop: `2px solid ${c.ac}33`, marginTop: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: c.tx }}>Total</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: c.ac, fontFamily: MONO }}>{fmt(netAmount)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Invoice details + breakdown — stacks on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 16, marginBottom: isMobile ? 14 : 22 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Invoice details</h3>
            {!editingClient && inv.status !== "paid" && (
              <button
                onClick={startEditClient}
                title="Edit client details"
                style={{ background: "none", border: `1px solid ${c.bd}`, borderRadius: 6, cursor: "pointer", fontSize: 12, color: c.tm, padding: "3px 10px", fontFamily: FONT }}
              >
                ✏ Edit
              </button>
            )}
          </div>

          {editingClient ? (
            <div>
              {[
                { label: "Client name", key: "name", ph: "e.g. Mega Corp Ltd" },
                { label: "Client email", key: "email", ph: "accounts@client.com", type: "email" },
                { label: "Address", key: "address", ph: "Full address", ta: true },
                { label: "Client ref / PO", key: "ref", ph: "Optional PO number" },
              ].map(({ label, key, ph, type, ta }) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: c.tm, display: "block", marginBottom: 4 }}>{label}</label>
                  {ta ? (
                    <textarea
                      value={clientEdit[key]}
                      onChange={e => setClientEdit(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={ph}
                      rows={2}
                      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${c.bd}`, borderRadius: 7, fontFamily: FONT, fontSize: 12, color: c.tx, background: c.bg, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                    />
                  ) : (
                    <input
                      type={type || "text"}
                      value={clientEdit[key]}
                      onChange={e => setClientEdit(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={ph}
                      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${c.bd}`, borderRadius: 7, fontFamily: FONT, fontSize: 12, color: c.tx, background: c.bg, outline: "none", boxSizing: "border-box" }}
                    />
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Btn onClick={saveClientDetails} dis={savingClient || !clientEdit.name.trim() || !clientEdit.email.trim()} sz="sm">
                  {savingClient ? "Saving…" : "Save"}
                </Btn>
                <button
                  onClick={() => setEditingClient(false)}
                  style={{ background: "none", border: "none", color: c.td, cursor: "pointer", fontSize: 12, fontFamily: FONT }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {[
                ["Client", inv.client_name],
                ["Email", inv.client_email],
                inv.client_ref ? ["Client ref / PO", inv.client_ref] : null,
                hasVat ? ["Net amount", fmt(netAmount)] : ["Original", fmt(netAmount)],
                hasVat ? ["VAT", fmt(vatAmount)] : null,
                hasVat ? ["Total (inc. VAT)", fmt(invoiceTotal)] : null,
                ["Issued", formatDate(inv.issue_date)],
                ["Terms", `${inv.payment_term_days} days`],
                ["Due", formatDate(inv.due_date)],
                inv.paid_date ? ["Paid", formatDate(inv.paid_date)] : null,
              ]
                .filter(Boolean)
                .map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${c.bdl}` }}>
                    <span style={{ color: c.tm, fontSize: 13 }}>{k}</span>
                    <span style={{ color: c.tx, fontSize: 13, fontWeight: 500, textAlign: "right", maxWidth: "60%", wordBreak: "break-word" }}>{v}</span>
                  </div>
                ))}
            </>
          )}
        </Card>

        {ov && (
          <Card>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>What they now owe you</h3>
            <div style={{ fontSize: 10, color: c.td, marginBottom: 12 }}>Late Payment of Commercial Debts (Interest) Act 1998</div>
            {[
              [hasVat ? "Invoice (inc. VAT)" : "Original invoice", fmt(invoiceTotal), c.tx],
              ["Fixed penalty", `+${fmt(pen)}`, c.go],
              [`Interest (${dl}d)`, `+${fmt(interest)}`, c.go],
            ].map(([k, v, cl]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${c.bdl}` }}>
                <span style={{ color: c.tm, fontSize: 12 }}>{k}</span>
                <span style={{ color: cl, fontSize: 13, fontFamily: MONO, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 10, borderTop: `2px solid ${c.ac}33` }}>
              <span style={{ color: c.tx, fontSize: 13, fontWeight: 700 }}>TOTAL NOW OWED</span>
              <span style={{ color: c.ac, fontSize: isMobile ? 17 : 20, fontWeight: 700, fontFamily: MONO }}>{fmt(tot)}</span>
            </div>
            <div style={{ fontSize: 10, color: c.td, marginTop: 5, textAlign: "right" }}>+{fmt(netAmount * getDailyRate())}/day interest</div>
          </Card>
        )}

        {inv.status === "paid" && (
          <Card style={{ background: c.gnd, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }} aria-hidden="true">✓</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: c.gn }}>Paid</div>
            <div style={{ fontSize: 13, color: c.tm, marginTop: 4 }}>{formatDate(inv.paid_date)}</div>
          </Card>
        )}
      </div>

      <ChaseTimeline inv={inv} si={si} />

      {/* Post-final-notice guidance */}
      {inv.chase_stage === "final_notice" && inv.status !== "paid" && si >= CHASE_STAGES.length - 1 && (
        <Card style={{ marginTop: 16, background: "#fef2f2", borderColor: "#fca5a540" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#991b1b", margin: "0 0 8px" }}>All chase stages complete</h3>
          <p style={{ fontSize: 12, color: c.tx, lineHeight: 1.6, margin: "0 0 10px" }}>
            Hielda has sent all automated chase emails for this invoice. If payment still hasn't been received, here are your next steps:
          </p>
          <ul style={{ fontSize: 12, color: c.tx, lineHeight: 1.8, margin: "0 0 0 16px", padding: 0 }}>
            <li><strong>Contact the client directly</strong> — a phone call can sometimes resolve things faster.</li>
            <li><strong>Send a Letter Before Action (LBA)</strong> — a formal letter giving 14 days to pay before court proceedings. Templates are available online.</li>
            <li><strong>Small Claims Court</strong> — for debts under £10,000 in England/Wales, you can file a claim online at <span style={{ fontFamily: MONO, fontSize: 11 }}>gov.uk/make-money-claim</span> for a small fee.</li>
            <li><strong>Debt recovery agency</strong> — for larger amounts, consider instructing a commercial debt recovery service.</li>
          </ul>
          <p style={{ fontSize: 11, color: c.tm, margin: "10px 0 0" }}>
            Interest and penalties continue to accrue. You can reference the total amount shown above in any formal correspondence.
          </p>
        </Card>
      )}

      {/* Auto-chase toggle */}
      {inv.status !== "paid" && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "10px 14px" : "12px 18px",
          background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 10,
          marginTop: 16, marginBottom: 16, gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.tx }}>Automatic chasing</div>
            <div style={{ fontSize: 11, color: c.tm, marginTop: 2 }}>
              {autoChase ? "Hielda will send chase emails automatically" : "Chase emails paused for this invoice"}
            </div>
          </div>
          <button
            onClick={toggleAutoChase}
            style={{
              width: 44, height: 24, borderRadius: 12, border: "none",
              background: autoChase ? c.ac : c.bd,
              cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
            aria-label={autoChase ? "Disable automatic chasing" : "Enable automatic chasing"}
          >
            <div style={{
              width: 18, height: 18, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 3, left: autoChase ? 23 : 3,
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }} />
          </button>
        </div>
      )}

      {/* Fines toggle — ON (blue) = fines applied, OFF (grey) = no fines */}
      {inv.status !== "paid" && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "10px 14px" : "12px 18px",
          background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 10,
          marginBottom: 16, gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.tx }}>Apply statutory penalties</div>
              <button
                type="button"
                onClick={() => setShowFinesInfo(v => !v)}
                style={{
                  width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${c.bd}`,
                  background: showFinesInfo ? c.acd : c.sf, color: showFinesInfo ? c.ac : c.td,
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0,
                }}
                aria-label="About statutory penalties"
              >
                ?
              </button>
            </div>
            <div style={{ fontSize: 11, color: c.tm, marginTop: 2 }}>
              {noFines ? "Chase emails won't include fines or interest — chasing only" : "Statutory interest and a fixed penalty will be applied when overdue"}
            </div>
            {showFinesInfo && (
              <div style={{
                marginTop: 8, padding: "10px 12px", background: c.acd, borderRadius: 8,
                border: `1px solid ${c.ac}30`, fontSize: 12, color: c.tx, lineHeight: 1.6,
              }}>
                When enabled, overdue chase emails will include statutory interest and a fixed penalty under the Late Payment Act. When disabled, Hielda will still chase this invoice but emails won't mention any additional charges. Useful if you'd prefer to keep things informal with a particular client.
              </div>
            )}
          </div>
          <button
            onClick={toggleNoFines}
            style={{
              width: 44, height: 24, borderRadius: 12, border: "none",
              background: noFines ? c.bd : c.ac,
              cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
            aria-label={noFines ? "Enable statutory penalties" : "Disable statutory penalties"}
          >
            <div style={{
              width: 18, height: 18, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 3, left: noFines ? 3 : 23,
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }} />
          </button>
        </div>
      )}

      {/* CC / BCC recipients */}
      {inv.status !== "paid" && (
        <Card style={{ marginTop: 0, marginBottom: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Email recipients</h3>
          <p style={{ fontSize: 11, color: c.td, margin: "0 0 14px" }}>You're always CC'd automatically. Add others below.</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.tx, display: "block", marginBottom: 5 }}>CC (optional)</label>
              <input
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                placeholder="sarah@company.com, boss@company.com"
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${c.bd}`, borderRadius: 8, fontFamily: FONT, fontSize: 12, color: c.tx, background: c.bg, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.tx, display: "block", marginBottom: 5 }}>BCC (optional)</label>
              <input
                value={bccEmails}
                onChange={(e) => setBccEmails(e.target.value)}
                placeholder="accountant@mine.com"
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${c.bd}`, borderRadius: 8, fontFamily: FONT, fontSize: 12, color: c.tx, background: c.bg, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <Btn sz="sm" dis={savingRecipients} onClick={async () => {
            setSavingRecipients(true)
            try {
              await supabase.from("invoices").update({
                cc_emails: ccEmails.trim() || null,
                bcc_emails: bccEmails.trim() || null,
              }).eq("id", inv.id)
              onUpdate()
            } catch (e) {
              setError("Failed to save recipients: " + e.message)
            }
            setSavingRecipients(false)
          }}>
            {savingRecipients ? "Saving..." : "Save"}
          </Btn>
        </Card>
      )}

      {/* Delivery failure warning */}
      {chaseLogs.some(l => l.delivery_status === "bounced" || l.delivery_status === "complained") && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#991b1b", marginBottom: 2 }}>Email delivery problem</div>
            <div style={{ fontSize: 12, color: "#7f1d1d" }}>
              {chaseLogs.some(l => l.delivery_status === "bounced")
                ? `One or more emails failed to reach ${inv.client_email}. The address may be incorrect — check it and contact the client directly if needed.`
                : `An email was marked as spam by ${inv.client_email}. Consider contacting the client directly.`}
            </div>
          </div>
        </div>
      )}

      {/* Chase log */}
      {chaseLogs.length > 0 && (
        <Card style={{ marginTop: 0 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>Chase log</h3>
          {chaseLogs.map((log) => {
            const stg = CHASE_STAGES.find((s) => s.id === log.chase_stage)
            const isCheckIn = log.status === "check_in_sent"
            const isMarkedPaid = log.status === "marked_paid_via_check_in"
            const statusLabel = isCheckIn
              ? `Check-in: ${stg?.label || log.chase_stage}`
              : isMarkedPaid
              ? "Marked paid via check-in"
              : stg?.label || log.chase_stage
            const dotColor = isCheckIn ? c.ac : isMarkedPaid ? c.gn : stg?.col || c.ac

            const deliveryBadge = log.delivery_status === "delivered"
              ? { label: "Delivered", color: c.gn, bg: c.gnd }
              : log.delivery_status === "bounced"
              ? { label: "Bounced", color: "#991b1b", bg: "#fef2f2" }
              : log.delivery_status === "complained"
              ? { label: "Spam report", color: "#92400e", bg: "#fffbeb" }
              : log.delivery_status === "delayed"
              ? { label: "Delayed", color: c.tm, bg: c.sf }
              : log.status === "sent"
              ? { label: "Pending", color: c.td, bg: c.sf }
              : null

            return (
              <div key={log.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderBottom: `1px solid ${c.bdl}`,
                flexWrap: isMobile ? "wrap" : "nowrap", gap: isMobile ? 4 : 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: c.tx }}>{statusLabel}</span>
                      {deliveryBadge && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: deliveryBadge.bg, color: deliveryBadge.color }}>
                          {deliveryBadge.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: c.td }}>{isCheckIn ? "Sent to you" : `Sent to ${log.email_to}`}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: c.td, marginLeft: isMobile ? 16 : 0 }}>{formatDate(log.sent_at)}</div>
              </div>
            )
          })}
        </Card>
      )}

      {/* Email preview modal — responsive */}
      {previewHtml && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: isMobile ? 12 : 0 }}>
          <div style={{
            background: c.sf, borderRadius: 14,
            width: isMobile ? "100%" : 680,
            maxWidth: "100%",
            maxHeight: isMobile ? "90vh" : "80vh",
            overflow: "hidden", display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${c.bd}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: c.tx }}>Email Preview</span>
              <button onClick={() => setPreviewHtml(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: c.tm }}>×</button>
            </div>
            <iframe
              srcDoc={previewHtml}
              style={{ flex: 1, border: "none", minHeight: isMobile ? 300 : 400 }}
              title="Email preview"
            />
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${c.bd}`, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <Btn v="ghost" onClick={() => setPreviewHtml(null)} sz="sm">Close</Btn>
              <Btn
                onClick={() => { setPreviewHtml(null); sendChaseEmail() }}
                dis={sending}
                sz="sm"
              >
                {sending ? "Sending..." : `📤 Send`}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
