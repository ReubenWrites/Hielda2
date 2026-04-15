import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabase"
import { colors as c, MONO, CHASE_STAGES, FONT, getRate, getDailyRate } from "../constants"
import { daysLate, calcInterest, penalty, fmt, formatDate, addDays, round2 } from "../utils"
import { Card, Badge, Btn, ErrorBanner } from "./ui"
import { buildChaseEmail } from "../lib/emailTemplates"
import { trackEvent } from "../posthog"
import DisputeModal from "./DisputeModal"
import ResolveDisputeModal from "./ResolveDisputeModal"
import s from "./Detail.module.css"

const STAGE_ORDER = ["reminder_1", "reminder_2", "final_warning", "first_chase", "second_chase", "third_chase", "chase_4", "chase_5", "chase_6", "chase_7", "chase_8", "chase_9", "chase_10", "chase_11", "escalation_1", "escalation_2", "escalation_3", "escalation_4", "final_notice", "recovery_1", "recovery_2", "recovery_3", "recovery_4", "recovery_5", "recovery_6", "recovery_7", "recovery_8", "recovery_9", "recovery_10", "recovery_11", "recovery_final"]

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
  {
    label: "Final Recovery",
    desc: "Last chance — updated amount every 2 days",
    col: "#450a0a",
    stages: ["recovery_1", "recovery_2", "recovery_3", "recovery_4"],
  },
  {
    label: "Imminent Referral",
    desc: "Daily countdown to formal recovery referral",
    col: "#27272a",
    stages: ["recovery_5", "recovery_6", "recovery_7", "recovery_8", "recovery_9", "recovery_10", "recovery_11", "recovery_final"],
  },
]

function ChaseTimeline({ inv, si }) {
  const [expanded, setExpanded] = useState({})

  const toggle = (label) => setExpanded((prev) => ({ ...prev, [label]: !prev[label] }))

  const currentGroup = TIMELINE_GROUPS.find((g) => g.stages.includes(inv.chase_stage))

  return (
    <Card>
      <h3 className={s.timelineSectionHeading}>Chase Timeline</h3>
      <p className={s.timelineDesc}>We check in with you before every step. Click a section to see details.</p>
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
          <div key={group.label} className={s.timelineGroupWrap}>
            <button
              onClick={() => toggle(group.label)}
              className={s.timelineGroupBtn}
              style={{
                background: allPast ? "rgba(22,163,74,0.05)" : somePast ? "rgba(30,95,160,0.05)" : c.bg,
                border: `1px solid ${allPast ? "rgba(22,163,74,0.15)" : somePast ? "rgba(30,95,160,0.15)" : c.bd}`,
              }}
            >
              <div
                className={s.timelineGroupCircle}
                style={{
                  background: allPast ? c.gn : somePast ? group.col : c.bg,
                  border: `2px solid ${allPast ? c.gn : somePast ? group.col : c.bd}`,
                  color: allPast || somePast ? c.w : c.td,
                }}
              >
                {allPast ? "✓" : somePast ? "•" : ""}
              </div>
              <div className={s.timelineGroupContent}>
                <div className={s.timelineGroupHeader}>
                  <span className={s.timelineGroupLabel} style={{ color: allPast ? c.gn : somePast ? c.tx : c.td }}>{group.label}</span>
                  {isCurrentGroup && <Badge color={group.col}>Active</Badge>}
                  <span className={s.timelineGroupCount}>{groupStages.length} {groupStages.length === 1 ? "email" : "emails"}</span>
                </div>
                <div className={s.timelineGroupDate}>{dateRange}</div>
              </div>
              <span className={isOpen ? s.timelineGroupArrowOpen : s.timelineGroupArrow}>▼</span>
            </button>

            {isOpen && (
              <div className={s.timelineStageList} style={{ borderLeft: `2px solid ${group.col}20` }}>
                <p className={s.timelineStageDesc}>{group.desc}</p>
                {groupStages.map((stg) => {
                  const act = stg.id === inv.chase_stage
                  const past = si >= 0 && CHASE_STAGES.indexOf(stg) <= si
                  return (
                    <div key={stg.id} className={s.timelineStageRow}>
                      <div
                        className={s.timelineStageDot}
                        style={{
                          background: past ? stg.col : "transparent",
                          border: `2px solid ${past ? stg.col : c.bd}`,
                          color: past ? c.w : c.td,
                        }}
                      >
                        {past ? "✓" : ""}
                      </div>
                      <span className={s.timelineStageLabel} style={{ fontWeight: act ? 700 : 400, color: past ? c.tx : c.td }}>{stg.label}</span>
                      {act && <Badge color={stg.col}>Next</Badge>}
                      <span className={s.timelineStageDfd}>
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

const LIFECYCLE_MILESTONES = [
  { key: "created", label: "Created", short: "Created", col: "#1e5fa0" },
  { key: "reminders", label: "Reminders", short: "Remind", col: "#2d72b8" },
  { key: "due", label: "Due Date", short: "Due", col: "#b45309" },
  { key: "overdue", label: "Overdue", short: "Overdue", col: "#d97706" },
  { key: "escalation", label: "Escalation", short: "Escalate", col: "#9f1239" },
  { key: "recovery", label: "Recovery", short: "Recovery", col: "#27272a" },
  { key: "resolved", label: "Resolved", short: "Resolved", col: "#16a34a" },
]

function stageToMilestone(stage) {
  if (!stage) return 0
  if (["reminder_1", "reminder_2"].includes(stage)) return 1
  if (stage === "final_warning") return 2
  if (["first_chase", "second_chase", "third_chase"].includes(stage)) return 3
  if (["chase_4","chase_5","chase_6","chase_7","chase_8","chase_9","chase_10","chase_11","escalation_1","escalation_2","escalation_3","escalation_4","final_notice"].includes(stage)) return 4
  if (stage.startsWith("recovery_")) return 5
  return 0
}

function InvoiceLifecycleBar({ inv, isMobile }) {
  const isPaid = inv.status === "paid"
  const isDisputed = inv.status === "disputed"
  const today = new Date()
  const dueDate = new Date(inv.due_date)

  // Determine current milestone index
  let current = stageToMilestone(inv.chase_stage)
  // Date-based minimum: if past due, at least at "due"
  if (!isPaid && today > dueDate && current < 2) current = 2
  if (!isPaid && today > dueDate && daysLate(inv.due_date) > 0 && current < 3) current = 3
  if (isPaid) current = 6

  // Milestone dates
  const dates = [
    inv.issue_date ? formatDate(inv.issue_date) : "",
    formatDate(addDays(inv.due_date, -5)),
    formatDate(inv.due_date),
    daysLate(inv.due_date) > 0 ? formatDate(addDays(inv.due_date, 1)) : "",
    formatDate(addDays(inv.due_date, 11)),
    formatDate(addDays(inv.due_date, 31)),
    isPaid && inv.paid_date ? formatDate(inv.paid_date) : formatDate(addDays(inv.due_date, 45)),
  ]

  return (
    <div className={isMobile ? s.lifecycleBarMobile : s.lifecycleBar}>
      <div className={s.lifecycleRow}>
        {LIFECYCLE_MILESTONES.map((m, i) => {
          const done = i <= current
          const isNext = i === current + 1 && !isPaid
          const isPaidDot = isPaid && i === 6
          const dotCol = isPaidDot ? "#16a34a" : done ? (i <= 2 ? "#1e5fa0" : LIFECYCLE_MILESTONES[i].col) : isNext ? LIFECYCLE_MILESTONES[i].col : c.bd

          return (
            <div key={m.key} className={s.lifecycleMilestone}>
              {/* Connecting line (not on first) */}
              {i > 0 && (
                <div
                  className={s.lifecycleLine}
                  style={{
                    background: i <= current ? (isPaid && i === 6 ? "#16a34a" : LIFECYCLE_MILESTONES[Math.min(i, current)].col) : c.bd,
                  }}
                />
              )}
              {/* Dot */}
              <div
                className={s.lifecycleDot}
                style={{
                  width: isNext ? 22 : 18,
                  height: isNext ? 22 : 18,
                  background: done || isNext ? dotCol : c.bg,
                  border: `2.5px solid ${dotCol}`,
                  boxShadow: isNext ? `0 0 0 3px ${dotCol}25` : "none",
                }}
              >
                {done ? "✓" : ""}
              </div>
              {/* Label */}
              <div
                className={isMobile ? s.lifecycleLabelMobile : s.lifecycleLabel}
                style={{ fontWeight: done || isNext ? 700 : 500, color: done || isNext ? c.tx : c.td }}
              >
                {isMobile ? m.short : m.label}
              </div>
              {/* Date */}
              {dates[i] && (
                <div className={s.lifecycleDate}>
                  {dates[i]}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Detail({ inv, profile, onUpdate, isMobile, editChase, onEditChaseDone }) {
  const navigate = useNavigate()
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
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [showMore, setShowMore] = useState(false)

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

  // Auto-open email preview when arriving via "edit the chase email" link
  useEffect(() => {
    if (editChase && inv && profile) {
      const email = buildChaseEmail(inv, profile, getStageToBeSent(inv), profile.chase_tone || 'firm')
      if (email) setPreviewHtml(email.html)
      if (onEditChaseDone) onEditChaseDone()
    }
  }, [editChase, inv?.id])

  if (!inv) {
    return (
      <div className={s.notFound}>
        <div className={s.notFoundIcon}>🔍</div>
        <div className={s.notFoundTitle}>Invoice not found</div>
        <div className={s.notFoundBody}>This invoice may have been deleted.</div>
        <Btn onClick={() => navigate("/dashboard")}>Back to Dashboard</Btn>
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
  const ex = round2(interest + pen)
  const tot = round2(invoiceTotal + ex)
  const si = CHASE_STAGES.findIndex((s) => s.id === inv.chase_stage)

  // VAT breakdown from line items
  const vatBreakdown = hasVat && inv.line_items ? inv.line_items.reduce((acc, li) => {
    const amt = parseFloat(li.amount) || 0
    const rate = li.vatRate || "0"
    if (rate === "exempt" || rate === "0") return acc
    const rateNum = parseFloat(rate) || 0
    acc[rate] = round2((acc[rate] || 0) + round2(amt * rateNum / 100))
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
    try {
      const email = buildChaseEmail(inv, profile, currentSendStage, profile.chase_tone || 'firm')
      if (email) {
        setPreviewHtml(email.html)
      } else {
        setError(`Unable to generate preview for stage "${getStageLabel(currentSendStage)}". The email will still send correctly.`)
      }
    } catch (e) {
      setError("Failed to generate email preview: " + e.message)
    }
  }

  const deleteInvoice = async () => {
    if (!window.confirm(`Permanently delete invoice ${inv.ref}? This cannot be undone.`)) return
    setDeleting(true)
    setError("")
    try {
      const { error: err } = await supabase.from("invoices").delete().eq("id", inv.id)
      if (err) throw err
      onUpdate()
      navigate("/dashboard")
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
      navigate("/dashboard")
    } catch (e) {
      setError("Failed to mark as paid: " + e.message)
    }
    setMarking(false)
  }

  const sendChaseEmail = async () => {
    if (sending) return // Guard against double-clicks
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
      if (!res.ok) {
        // Handle idempotency: if already sent, treat as success
        if (res.status === 409) {
          setSendSuccess(`${stageLabel} was already sent — refreshing status.`)
          onUpdate()
          setTimeout(() => setSendSuccess(""), 5000)
          setSending(false)
          return
        }
        throw new Error(data.error || "Failed to send")
      }
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

  const handleDispute = async ({ reason, notes, sendEmail }) => {
    setDisputing(true)
    setError("")
    try {
      const { error: err } = await supabase
        .from("invoices")
        .update({
          status: "disputed",
          auto_chase: false,
          dispute_reason: reason,
          dispute_notes: notes,
          dispute_date: new Date().toISOString(),
        })
        .eq("id", inv.id)
      if (err) throw err

      if (sendEmail) {
        const session = await supabase.auth.getSession()
        await fetch("/api/send-dispute-ack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_id: inv.id, user_token: session.data.session?.access_token }),
        })
      }

      setShowDisputeModal(false)
      onUpdate()
    } catch (e) {
      setError("Failed to mark as disputed: " + e.message)
    }
    setDisputing(false)
  }

  const handleResolve = async ({ outcome, notes }) => {
    setDisputing(true)
    setError("")
    try {
      const resumeStatus = outcome === "paid" ? "paid" : new Date(inv.due_date) < new Date() ? "overdue" : "pending"
      const updates = {
        status: resumeStatus,
        auto_chase: outcome !== "paid" && outcome !== "written_off",
        resolution_outcome: outcome,
        resolution_notes: notes,
        resolution_date: new Date().toISOString(),
      }
      if (outcome === "paid") {
        updates.paid_date = new Date().toISOString().split("T")[0]
        updates.chase_stage = null
      } else if (outcome === "adjusted") {
        updates.chase_stage = "reminder_1"
      } else if (outcome === "written_off") {
        updates.chase_stage = null
      }
      const { error: err } = await supabase
        .from("invoices")
        .update(updates)
        .eq("id", inv.id)
      if (err) throw err

      // Send resolution email to client
      try {
        const session = await supabase.auth.getSession()
        await fetch("/api/send-dispute-ack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoice_id: inv.id,
            user_token: session.data.session?.access_token,
            action: "resolve",
            outcome,
          }),
        })
      } catch (_) {
        // Non-critical: don't block resolution if email fails
      }

      setShowResolveModal(false)
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
      <button onClick={() => navigate("/dashboard")} className={s.backBtn}>
        ← Back to Dashboard
      </button>

      {/* Header: title + badges */}
      <div className={isMobile ? s.headerSectionMobile : s.headerSection}>
        <div className={s.headerRow}>
          <h1 className={isMobile ? s.headerTitleMobile : s.headerTitle}>{inv.ref}</h1>
          <Badge color={inv.status === "paid" ? c.gn : ov ? c.or : isDisputed ? "#7c3aed" : c.am}>
            {ov ? "being chased" : isDisputed ? "disputed" : inv.status}
          </Badge>
          {isConsumer && <Badge color={c.am}>consumer</Badge>}
          {!isConsumer && inv.no_fines && <Badge color={c.td}>no fines</Badge>}
        </div>
        <p className={s.headerSub}>{inv.client_name} · {inv.description}</p>
      </div>

      {/* Lifecycle progress bar */}
      <InvoiceLifecycleBar inv={inv} isMobile={isMobile} />

      {/* Action buttons — primary row + More menu */}
      <div className={isMobile ? s.actionRowMobile : s.actionRow}>
        {/* Primary actions */}
        {inv.status !== "paid" && (
          <Btn v="successAction" onClick={markPaid} dis={marking} sz={isMobile ? "sm" : undefined}>
            {marking ? "..." : "✓ Paid"}
          </Btn>
        )}
        {inv.status !== "paid" && (
          <Btn v="ghost" onClick={() => {
            try { localStorage.setItem("hielda_edit", JSON.stringify(inv)) } catch {}
            navigate("/create")
          }} sz="sm">
            ✏ Edit
          </Btn>
        )}
        {inv.status !== "paid" && (
          <Btn v="ghost" onClick={() => setShowPartialPayment(v => !v)} sz="sm">
            💰 Part Paid
          </Btn>
        )}
        {inv.status !== "paid" && !isDisputed && (
          <Btn v="ghost" onClick={() => setShowDisputeModal(true)} dis={disputing} sz="sm" style={{ color: "#7c3aed", borderColor: "#7c3aed40" }}>
            ⚑ Dispute
          </Btn>
        )}
        {isDisputed && (
          <Btn v="ghost" onClick={() => setShowResolveModal(true)} dis={disputing} sz="sm" style={{ color: "#7c3aed", borderColor: "#7c3aed40" }}>
            {disputing ? "..." : "↩ Resolve"}
          </Btn>
        )}

        {/* More menu */}
        <div className={s.moreWrap}>
          <Btn v="ghost" onClick={() => setShowMore(v => !v)} sz="sm">
            ··· More
          </Btn>
          {showMore && (
            <>
              {/* Backdrop to close on click outside */}
              <div onClick={() => setShowMore(false)} className={s.moreBackdrop} />
              <div className={s.moreMenu}>
                {inv.status !== "paid" && inv.client_email && (
                  <button onClick={() => { setShowMore(false); sendChaseEmail() }} disabled={sending} className={s.menuBtn}>
                    <div className={s.menuBtnLabel}>📤 Send Chase</div>
                    <div className={s.menuBtnSub}>Next: {getStageLabel(currentSendStage)}</div>
                  </button>
                )}
                {inv.status !== "paid" && inv.client_email && (
                  <button onClick={() => { setShowMore(false); showEmailPreview() }} className={s.menuBtn}>
                    📧 Preview Chase Email
                  </button>
                )}
                {inv.status !== "paid" && !inv.client_email && (
                  <div className={s.menuNoEmail}>
                    ⚠ No client email — chase unavailable
                  </div>
                )}
                <div className={s.menuDivider} />
                <button onClick={() => { setShowMore(false); downloadPdf() }} disabled={downloading} className={s.menuBtn}>
                  📥 Download PDF
                </button>
                <button onClick={() => {
                  setShowMore(false)
                  try { localStorage.setItem("hielda_clone", JSON.stringify({
                    cn: inv.client_name, ce: inv.client_email, ca: inv.client_address || "",
                    lineItems: inv.line_items?.length ? inv.line_items : [{ description: inv.description || "", amount: String(inv.amount) }],
                    clientRef: inv.client_ref || "", cc: inv.cc_emails || "", bcc: inv.bcc_emails || "",
                    terms: String(inv.payment_term_days || 30), noFines: inv.no_fines || false,
                  })) } catch {}
                  navigate("/create")
                }} className={s.menuBtn}>
                  📋 Clone Invoice
                </button>
                <div className={s.menuDivider} />
                <button onClick={() => { setShowMore(false); deleteInvoice() }} disabled={deleting} className={s.menuBtnDanger}>
                  🗑 Delete Invoice
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {isDisputed && (
        <div className={s.disputeBanner}>
          <div>
            <div className={s.disputeTitle}>Invoice under dispute</div>
            <div className={s.disputeBody}>
              Chasing is paused while this is resolved. Click <strong>Resolve Dispute</strong> above to resume chasing, or <strong>✓ Paid</strong> if it has been settled.
            </div>
            {inv.dispute_reason && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#5b21b6" }}>
                <strong>Reason:</strong> {inv.dispute_reason.replace(/_/g, " ")}
                {inv.dispute_notes && <> — {inv.dispute_notes}</>}
                {inv.dispute_date && <span style={{ color: "#94a3b8", marginLeft: 8 }}>{formatDate(inv.dispute_date)}</span>}
              </div>
            )}
            {inv.resolution_outcome && (
              <div style={{ marginTop: 4, fontSize: 12, color: "#16a34a" }}>
                <strong>Resolved:</strong> {inv.resolution_outcome.replace(/_/g, " ")}
                {inv.resolution_notes && <> — {inv.resolution_notes}</>}
                {inv.resolution_date && <span style={{ color: "#94a3b8", marginLeft: 8 }}>{formatDate(inv.resolution_date)}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Partial payment form */}
      {showPartialPayment && inv.status !== "paid" && (
        <div className={s.partialForm}>
          <div className={s.partialFormTitle}>Record a partial payment</div>
          {amountPaid > 0 && (
            <div className={s.partialFormInfo}>
              Already received: <strong>{fmt(amountPaid)}</strong> of {fmt(inv.amount)} · Remaining: <strong>{fmt(amountRemaining)}</strong>
            </div>
          )}
          <div className={s.partialFormRow}>
            <input
              type="number"
              value={partialAmount}
              onChange={e => setPartialAmount(e.target.value)}
              placeholder={`Up to ${fmt(amountRemaining)}`}
              step="0.01"
              max={amountRemaining}
              className={s.partialInput}
            />
            <Btn sz="sm" onClick={recordPartialPayment} dis={savingPartial || !partialAmount || parseFloat(partialAmount) <= 0}>
              {savingPartial ? "..." : "Record"}
            </Btn>
            <button onClick={() => setShowPartialPayment(false)} className={s.cancelBtn}>Cancel</button>
          </div>
          {parseFloat(partialAmount) >= amountRemaining && partialAmount && (
            <div className={s.partialFullNote}>This will mark the invoice as fully paid.</div>
          )}
        </div>
      )}

      {/* Partial payment progress */}
      {amountPaid > 0 && inv.status !== "paid" && (
        <div className={s.partialProgress}>
          <div className={s.partialProgressHeader}>
            <span className={s.partialProgressLabel}>Partial payment received</span>
            <span className={s.partialProgressAmt}>{fmt(amountPaid)} / {fmt(inv.amount)}</span>
          </div>
          <div className={s.partialProgressTrack}>
            <div className={s.partialProgressFill} style={{ width: `${Math.min(100, (amountPaid / Number(inv.amount)) * 100)}%` }} />
          </div>
          <div className={s.partialProgressRemaining}>{fmt(amountRemaining)} still outstanding</div>
        </div>
      )}

      {sendSuccess && (
        <div className={s.successBanner}>
          <span>✓</span> {sendSuccess}
        </div>
      )}

      {emailChanged && (
        <div className={s.emailChangedBanner}>
          <div className={s.emailChangedTitle}>📬 Client email updated</div>
          <div className={s.emailChangedBody}>
            The new recipient hasn't received any previous emails. What would you like to do?
          </div>
          <div className={s.emailChangedActions}>
            <Btn sz="sm" onClick={() => resendEmail("reminder_1", true)} dis={resending}>
              {resending ? "Sending…" : "Restart from day 1"}
            </Btn>
            {chaseLogs.length > 0 && (
              <Btn sz="sm" v="ghost" onClick={() => resendEmail(chaseLogs[0].chase_stage || chaseLogs[0].status, false)} dis={resending}>
                Resend last email only
              </Btn>
            )}
            <button onClick={() => setEmailChanged(false)} className={s.cancelBtn}>Dismiss</button>
          </div>
        </div>
      )}

      {ov && ex > 0 && (
        <div className={isMobile ? s.extrasBarMobile : s.extrasBar}>
          <div>
            <span className={s.extrasLabel}>Extra added by Hielda</span>
            <span className={s.extrasDetail}>penalty + {dl}d interest</span>
          </div>
          <div className={isMobile ? s.extrasAmountMobile : s.extrasAmount}>+{fmt(ex)}</div>
        </div>
      )}

      {/* Line items breakdown */}
      {inv.line_items?.length > 0 && (
        <Card style={{ marginBottom: isMobile ? 12 : 16 }}>
          <h3 className={s.sectionHeading}>Line Items</h3>
          <div className={hasVat ? s.lineItemsHeaderVat : s.lineItemsHeaderNoVat}>
            <span>Description</span>
            {hasVat && <span className={s.textRight}>VAT</span>}
            <span className={s.textRight}>Amount</span>
          </div>
          {inv.line_items.map((li, i) => (
            <div key={i} className={hasVat ? s.lineItemRowVat : s.lineItemRowNoVat}>
              <span className={s.lineItemDesc}>{li.description}</span>
              {hasVat && <span className={s.lineItemVatRate}>{li.vatRate === "exempt" ? "Exempt" : `${li.vatRate || 0}%`}</span>}
              <span className={s.lineItemAmount}>{fmt(li.amount)}</span>
            </div>
          ))}
          {hasVat ? (
            <>
              <div className={s.subtotalRow}>
                <span className={s.subtotalLabel}>Subtotal (ex. VAT)</span>
                <span className={s.subtotalValue}>{fmt(netAmount)}</span>
              </div>
              {Object.entries(vatBreakdown).filter(([, v]) => v > 0).map(([rate, amount]) => (
                <div key={rate} className={s.vatRow}>
                  <span className={s.subtotalLabel}>VAT @ {rate}%</span>
                  <span className={s.subtotalValue}>{fmt(amount)}</span>
                </div>
              ))}
              <div className={s.totalRow}>
                <span className={s.totalLabel}>Total (inc. VAT)</span>
                <span className={s.totalValue}>{fmt(invoiceTotal)}</span>
              </div>
            </>
          ) : (
            <div className={s.totalRow}>
              <span className={s.totalLabel}>Total</span>
              <span className={s.totalValue}>{fmt(netAmount)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Invoice details + breakdown — stacks on mobile */}
      <div className={isMobile ? s.detailGridMobile : s.detailGrid}>
        <Card>
          <div className={s.detailCardHeader}>
            <h3 className={s.detailCardHeading}>Invoice details</h3>
            {!editingClient && inv.status !== "paid" && (
              <button
                onClick={startEditClient}
                title="Edit client details"
                className={s.editBtn}
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
                <div key={key} className={s.editFieldGroup}>
                  <label className={s.editLabel}>{label}</label>
                  {ta ? (
                    <textarea
                      value={clientEdit[key]}
                      onChange={e => setClientEdit(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={ph}
                      rows={2}
                      className={s.editTextarea}
                    />
                  ) : (
                    <input
                      type={type || "text"}
                      value={clientEdit[key]}
                      onChange={e => setClientEdit(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={ph}
                      className={s.editInput}
                    />
                  )}
                </div>
              ))}
              <div className={s.editActions}>
                <Btn onClick={saveClientDetails} dis={savingClient || !clientEdit.name.trim() || !clientEdit.email.trim()} sz="sm">
                  {savingClient ? "Saving…" : "Save"}
                </Btn>
                <button
                  onClick={() => setEditingClient(false)}
                  className={s.cancelBtn}
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
                  <div key={k} className={s.detailRow}>
                    <span className={s.detailRowKey}>{k}</span>
                    <span className={s.detailRowValue}>{v}</span>
                  </div>
                ))}
            </>
          )}
        </Card>

        {ov && (
          <Card>
            <h3 className={s.oweHeading}>What they now owe you</h3>
            <div className={s.oweLaw}>Late Payment of Commercial Debts (Interest) Act 1998</div>
            {[
              [hasVat ? "Invoice (inc. VAT)" : "Original invoice", fmt(invoiceTotal), c.tx],
              ["Fixed penalty", `+${fmt(pen)}`, c.go],
              [`Interest (${dl}d)`, `+${fmt(interest)}`, c.go],
            ].map(([k, v, cl]) => (
              <div key={k} className={s.oweRow}>
                <span className={s.oweRowKey}>{k}</span>
                <span className={s.oweRowValue} style={{ color: cl }}>{v}</span>
              </div>
            ))}
            <div className={s.oweTotalRow}>
              <span className={s.oweTotalLabel}>TOTAL NOW OWED</span>
              <span className={isMobile ? s.oweTotalValueMobile : s.oweTotalValue}>{fmt(tot)}</span>
            </div>
            <div className={s.oweDailyRate}>+{fmt(netAmount * getDailyRate())}/day interest</div>
          </Card>
        )}

        {inv.status === "paid" && (
          <Card style={{ background: c.gnd }} className={s.paidCard}>
            <div className={s.paidIcon} aria-hidden="true">✓</div>
            <div className={s.paidLabel}>Paid</div>
            <div className={s.paidDate}>{formatDate(inv.paid_date)}</div>
          </Card>
        )}
      </div>

      <ChaseTimeline inv={inv} si={si} />

      {/* Post-final-notice guidance */}
      {inv.chase_stage === "recovery_final" && inv.status !== "paid" && si >= CHASE_STAGES.length - 1 && (
        <Card className={s.finalNoticeCard} style={{ marginTop: 16, background: "#fef2f2", borderColor: "#fca5a540" }}>
          <h3 className={s.finalNoticeTitle}>All chase stages complete</h3>
          <p className={s.finalNoticeBody}>
            Hielda has sent all automated chase emails for this invoice. If payment still hasn't been received, here are your next steps:
          </p>
          <ul className={s.finalNoticeList}>
            <li><strong>Contact the client directly</strong> — a phone call can sometimes resolve things faster.</li>
            <li><strong>Send a Letter Before Action (LBA)</strong> — a formal letter giving 14 days to pay before court proceedings. Templates are available online.</li>
            <li><strong>Small Claims Court</strong> — for debts under £10,000 in England/Wales, you can file a claim online at <span className={s.finalNoticeMono}>gov.uk/make-money-claim</span> for a small fee.</li>
            <li><strong>Debt recovery agency</strong> — for larger amounts, consider instructing a commercial debt recovery service.</li>
          </ul>
          <p className={s.finalNoticeFooter}>
            Interest and penalties continue to accrue. You can reference the total amount shown above in any formal correspondence.
          </p>
        </Card>
      )}

      {/* Auto-chase toggle */}
      {inv.status !== "paid" && (
        <div className={`${isMobile ? s.toggleRowMobile : s.toggleRow} ${s.autoChaseMargin}`}>
          <div className={s.toggleContent}>
            <div className={s.toggleTitle}>Automatic chasing</div>
            <div className={s.toggleSub}>
              {autoChase ? "Hielda will send chase emails automatically" : "Chase emails paused for this invoice"}
            </div>
          </div>
          <button
            onClick={toggleAutoChase}
            className={s.toggleTrack}
            style={{ background: autoChase ? c.ac : c.bd }}
            aria-label={autoChase ? "Disable automatic chasing" : "Enable automatic chasing"}
          >
            <div className={s.toggleThumb} style={{ left: autoChase ? 23 : 3 }} />
          </button>
        </div>
      )}

      {/* Fines toggle — uses positive "finesActive" for clarity; ON (blue) = fines applied, OFF (grey) = chase only */}
      {inv.status !== "paid" && (() => {
        const finesActive = !noFines
        return (
        <div className={`${isMobile ? s.toggleRowMobile : s.toggleRow} ${s.finesMargin}`}>
          <div className={s.toggleContentFlex}>
            <div className={s.toggleTitleRow}>
              <div className={s.toggleTitle}>
                Statutory penalties {finesActive ? "on" : "off"}
              </div>
              <button
                type="button"
                onClick={() => setShowFinesInfo(v => !v)}
                className={s.finesInfoBtn}
                style={{
                  background: showFinesInfo ? c.acd : c.sf,
                  color: showFinesInfo ? c.ac : c.td,
                }}
                aria-label="About statutory penalties"
              >
                ?
              </button>
            </div>
            <div className={s.toggleSub} style={{ color: finesActive ? c.gn : undefined }}>
              {finesActive
                ? "Statutory interest and a fixed penalty will be applied when overdue"
                : "Chase emails won't include fines or interest — chasing only"}
            </div>
            {showFinesInfo && (
              <div className={s.finesInfoPanel}>
                <strong>On:</strong> Overdue chase emails include statutory interest and a fixed penalty under the Late Payment Act 1998.<br />
                <strong>Off:</strong> Hielda still chases this invoice but emails won't mention additional charges. Useful for keeping things informal with a particular client.
              </div>
            )}
          </div>
          <button
            onClick={toggleNoFines}
            className={s.toggleTrack}
            style={{ background: finesActive ? c.ac : c.bd }}
            aria-label={finesActive ? "Turn off statutory penalties" : "Turn on statutory penalties"}
          >
            <div className={s.toggleThumb} style={{ left: finesActive ? 23 : 3 }} />
          </button>
        </div>
        )
      })()}

      {/* CC / BCC recipients */}
      {inv.status !== "paid" && (
        <Card style={{ marginTop: 0, marginBottom: 16 }}>
          <h3 className={s.recipientsHeading}>Email recipients</h3>
          <p className={s.recipientsDesc}>You're always CC'd automatically. Add others below.</p>
          <div className={s.recipientsGrid}>
            <div>
              <label className={s.recipientLabel}>CC (optional)</label>
              <input
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                placeholder="sarah@company.com, boss@company.com"
                className={s.recipientInput}
              />
            </div>
            <div>
              <label className={s.recipientLabel}>BCC (optional)</label>
              <input
                value={bccEmails}
                onChange={(e) => setBccEmails(e.target.value)}
                placeholder="accountant@mine.com"
                className={s.recipientInput}
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
        <div className={s.deliveryWarning}>
          <span className={s.deliveryWarningIcon}>⚠️</span>
          <div>
            <div className={s.deliveryWarningTitle}>Email delivery problem</div>
            <div className={s.deliveryWarningBody}>
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
          <h3 className={s.chaseLogHeading}>Chase log</h3>
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
              <div key={log.id} className={isMobile ? s.chaseLogEntryMobile : s.chaseLogEntry}>
                <div className={s.chaseLogLeft}>
                  <div className={s.chaseLogDot} style={{ background: dotColor }} />
                  <div className={s.chaseLogContent}>
                    <div className={s.chaseLogLabelRow}>
                      <span className={s.chaseLogLabel}>{statusLabel}</span>
                      {deliveryBadge && (
                        <span className={s.deliveryBadge} style={{ background: deliveryBadge.bg, color: deliveryBadge.color }}>
                          {deliveryBadge.label}
                        </span>
                      )}
                    </div>
                    <div className={s.chaseLogRecipient}>{isCheckIn ? "Sent to you" : `Sent to ${log.email_to}`}</div>
                  </div>
                </div>
                <div className={isMobile ? s.chaseLogDateMobile : s.chaseLogDate}>{formatDate(log.sent_at)}</div>
              </div>
            )
          })}
        </Card>
      )}

      {/* Email preview modal — responsive */}
      {previewHtml && (
        <div className={isMobile ? s.modalOverlayMobile : s.modalOverlay}>
          <div className={isMobile ? s.modalBoxMobile : s.modalBox}>
            <div className={s.modalHeader}>
              <span className={s.modalTitle}>Email Preview</span>
              <button onClick={() => setPreviewHtml(null)} className={s.modalCloseBtn}>×</button>
            </div>
            <iframe
              srcDoc={previewHtml}
              className={isMobile ? s.modalIframeMobile : s.modalIframe}
              title="Email preview"
            />
            <div className={s.modalFooter}>
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

      {showDisputeModal && (
        <DisputeModal invoice={inv} onConfirm={handleDispute} onClose={() => setShowDisputeModal(false)} />
      )}
      {showResolveModal && (
        <ResolveDisputeModal invoice={inv} onConfirm={handleResolve} onClose={() => setShowResolveModal(false)} />
      )}
    </div>
  )
}
