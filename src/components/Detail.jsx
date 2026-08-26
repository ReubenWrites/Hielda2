import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Check, Pencil, Wallet, Flag, RotateCcw, MoreHorizontal,
  Calendar, Mail, Forward, Send, Eye, Download, Copy, Trash2,
} from "lucide-react"
import { supabase } from "../supabase"
import { colors as c, MONO, CHASE_STAGES, FONT, getRate, getDailyRate } from "../constants"
import { daysLate, calcInterest, penalty, fmt, formatDate, addDays, round2, todayStr } from "../utils"
import { Card, Badge, Btn, ErrorBanner, useConfirm, useToast } from "./ui"
import { buildChaseEmail } from "../lib/emailTemplates"
import { buildIntroText } from "../lib/introText"
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
  const confirm = useConfirm()
  const toast = useToast()
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
  const [sendingInvoiceEmail, setSendingInvoiceEmail] = useState(false)
  const [editingClient, setEditingClient] = useState(false)
  const [clientEdit, setClientEdit] = useState({ name: "", email: "", address: "", ref: "" })
  const [savingClient, setSavingClient] = useState(false)
  const [emailChanged, setEmailChanged] = useState(false)
  const [resending, setResending] = useState(false)
  const [showPartialPayment, setShowPartialPayment] = useState(false)
  const [partialAmount, setPartialAmount] = useState("")
  // When the payment actually landed — backdatable, because nobody logs a
  // payment the day it arrives. Payments dated before the due date reduce
  // the debt that goes overdue, which lowers the fixed-fee tier.
  const [partialDate, setPartialDate] = useState(todayStr())
  const [payments, setPayments] = useState([])
  useEffect(() => {
    if (!inv?.id) return
    ;(async () => {
      const { data } = await supabase
        .from("invoice_payments")
        .select("id, amount, paid_on")
        .eq("invoice_id", inv.id)
        .order("paid_on", { ascending: true })
      setPayments(data || [])
    })()
  }, [inv?.id, inv?.amount_paid])
  const [savingPartial, setSavingPartial] = useState(false)
  // Settle-short flow: a checkbox for part payments accepted as full and
  // final, and a breakdown popup when a payment covers the invoice but
  // only part of the late charges.
  const [settleShort, setSettleShort] = useState(false)
  const [settlePrompt, setSettlePrompt] = useState(null)
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
  const paidSoFar = Number(inv.amount_paid) || 0
  const netOutstanding = Math.max(0, round2(netAmount - paidSoFar))
  // Interest accrues on what's still owed — a partial payment stops the
  // meter on the part that's been paid. The fixed sum tiers on the debt
  // as it stood when the invoice went overdue: payments dated before the
  // due date (paid_before_due) reduce that debt, so a mostly-pre-paid
  // invoice earns the £40 tier, not the £70 one.
  const debtAtDue = Math.max(0, round2(netAmount - (Number(inv.paid_before_due) || 0)))
  const interest = ov && finesEnabled ? calcInterest(netOutstanding, dl) : 0
  const pen = ov && finesEnabled && netOutstanding > 0 && debtAtDue > 0 ? penalty(debtAtDue) : 0
  const ex = round2(interest + pen)
  const tot = round2(invoiceTotal - paidSoFar + ex)
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
      // Direct fetch (rather than supabase.functions.invoke) so we can read
      // the JSON error body when the function returns 5xx — invoke() only
      // surfaces a generic "non-2xx" message which hides the real cause.
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
        body: JSON.stringify({ invoice_id: inv.id }),
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
      a.download = `${inv.ref}.pdf`
      a.click()
      URL.revokeObjectURL(objectUrl)
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
    if (!(await confirm({
      title: `Delete invoice ${inv.ref}?`,
      message: "This cannot be undone. Any chase emails sent for this invoice will also be removed from your history.",
      confirmLabel: "Delete invoice",
      cancelLabel: "Keep it",
      danger: true,
    }))) return
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
      // One-shot flag for the dashboard's payment celebration + referral
      // nudge — the moment an invoice gets paid is the moment users are
      // happiest with Hielda, which is the right time to ask for a share.
      try {
        sessionStorage.setItem("hielda_paid_celebration", JSON.stringify({
          client: inv.client_name || "Your client",
          amount: Number(inv.amount),
          extra: ov ? ex : 0,
        }))
      } catch {}
      onUpdate()
      navigate("/dashboard")
    } catch (e) {
      setError("Failed to mark as paid: " + e.message)
    }
    setMarking(false)
  }

  // Recovery for accidental "Mark as paid" clicks. Reverts to pending —
  // App.jsx then re-derives 'overdue' from due_date if it's in the past.
  // Doesn't touch amount_paid, so any partial-payment history is preserved.
  const unmarkPaid = async () => {
    // Reassurance copy: a common worry is "if I unmark this, will Hielda
    // suddenly hammer my client?". The answer is no — chases only ever
    // go out after the freelancer explicitly approves via the check-in
    // email, even on auto-chase invoices. Spelling that out here.
    if (!(await confirm({
      title: "Mark this invoice as unpaid?",
      message: "Your client will NOT be chased automatically. Hielda always emails you first to ask before sending anything to them — even on overdue invoices.\n\nAny partial-payment history is kept.",
      confirmLabel: "Mark as unpaid",
      cancelLabel: "Cancel",
    }))) return
    setMarking(true)
    setError("")
    try {
      const { error: err } = await supabase
        .from("invoices")
        .update({ status: "pending", paid_date: null })
        .eq("id", inv.id)
      if (err) throw err
      trackEvent("invoice_unmarked_paid", { ref: inv.ref })
      onUpdate()
    } catch (e) {
      setError("Failed to unmark as paid: " + e.message)
    }
    setMarking(false)
  }

  // Retro-adjust the due date so interest stops or restarts accruing from
  // a different point. Common scenario: user picked 7-day terms by mistake
  // when creating the invoice, then realised they never actually agreed
  // 7 days with the client. Lets them set the date to what was really
  // agreed without redoing the whole invoice.
  //
  // After change: chase_stage is reset to null so the auto-chase
  // reconciliation can re-derive the right stage from the new due_date.
  // App.jsx will re-derive status from due_date on the next render
  // (pending if future, overdue if past).
  const [showAdjustDue, setShowAdjustDue] = useState(false)
  const [newDueDate, setNewDueDate] = useState(inv?.due_date || "")
  const [adjusting, setAdjusting] = useState(false)
  const adjustDueDate = async () => {
    if (!newDueDate || newDueDate === inv.due_date) { setShowAdjustDue(false); return }
    const future = new Date(newDueDate) > new Date()
    if (!(await confirm({
      title: `Change the due date to ${formatDate(newDueDate)}?`,
      message: `This is when statutory interest will start accruing if unpaid.\n\n${future
        ? "Since the new date is in the future, the invoice will go back to 'pending' and no interest will currently apply."
        : "The new date is in the past — interest will accrue from that date forward."}\n\nAny chase emails already sent will remain in the chase log.`,
      confirmLabel: "Update due date",
      cancelLabel: "Cancel",
    }))) return
    setAdjusting(true)
    setError("")
    try {
      // The confirm above promises "the invoice will go back to pending"
      // for future dates — so actually flip the status. Without this the
      // invoice stayed 'overdue' and the dashboard kept showing fines and
      // interest that no longer apply. Paid/disputed are never touched.
      const updates = { due_date: newDueDate, chase_stage: null }
      if (inv.status === "overdue" || inv.status === "pending") {
        updates.status = future ? "pending" : "overdue"
      }
      const { error: err } = await supabase
        .from("invoices")
        .update(updates)
        .eq("id", inv.id)
      if (err) throw err
      setShowAdjustDue(false)
      trackEvent("invoice_due_date_adjusted", { ref: inv.ref })
      onUpdate()
    } catch (e) {
      setError("Failed to update due date: " + e.message)
    }
    setAdjusting(false)
  }

  // Recovery path for when the create-time intro email failed (e.g. network
  // glitch, server error). Sends the same introduction + invoice email that
  // would normally fire from the Create flow, so users don't have to fall
  // back to the chase flow just because the first send didn't go through.
  const sendInvoiceEmail = async () => {
    if (sendingInvoiceEmail) return
    if (!inv.client_email) {
      setError("This invoice has no client email address.")
      return
    }
    if (!(await confirm({
      title: `Send invoice email to ${inv.client_name}?`,
      message: `The invoice details and PDF will be sent to ${inv.client_email}. You'll be BCC'd a copy.`,
      confirmLabel: "Send invoice",
      cancelLabel: "Cancel",
    }))) return

    setSendingInvoiceEmail(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const introText = buildIntroText(profile, inv.client_name)
      const res = await fetch("/api/send-intro-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: inv.client_name,
          client_email: inv.client_email,
          intro_text: introText,
          invoice_id: inv.id,
          user_token: session?.access_token,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = text
        try { msg = JSON.parse(text).error || text } catch {}
        throw new Error(msg || `Send failed (${res.status})`)
      }
      toast.success(`Invoice email sent to ${inv.client_email}`)
    } catch (e) {
      setError("Failed to send invoice email: " + e.message)
    }
    setSendingInvoiceEmail(false)
  }

  // Sends a fresh copy of the invoice (line items, totals, payment details,
  // notes) to the freelancer's own address. Useful if they want to forward
  // to an accountant or just keep a copy outside the client thread.
  const sendCopyToSelf = async () => {
    if (sendingInvoiceEmail) return
    setSendingInvoiceEmail(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/send-self-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: inv.id, user_token: session?.access_token }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = text
        try { msg = JSON.parse(text).error || text } catch {}
        throw new Error(msg || `Send failed (${res.status})`)
      }
      const data = await res.json()
      toast.success(`Copy sent to ${data.sent_to || "your email"}`)
    } catch (e) {
      setError("Failed to send copy: " + e.message)
    }
    setSendingInvoiceEmail(false)
  }

  const sendChaseEmail = async ({ skipConfirm = false } = {}) => {
    if (sending) return // Guard against double-clicks
    const stage = currentSendStage
    const stageLabel = getStageLabel(stage)

    if (!skipConfirm) {
      const ccText = ccEmails.trim() ? `\n\nCC: ${ccEmails.trim()}` : ""
      const confirmed = await confirm({
        title: `Send "${stageLabel}" to ${inv.client_name}?`,
        message: `The chase email and PDF will be sent to ${inv.client_email}.${ccText}\n\nYou'll be BCC'd automatically (your client won't see you on the recipient list).`,
        confirmLabel: "Send chase",
        cancelLabel: "Not yet",
      })
      if (!confirmed) return
    }

    setSending(true)
    setError("")
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
          toast.info(`${stageLabel} was already sent — refreshing status.`)
          onUpdate()
          setSending(false)
          return
        }
        throw new Error(data.error || "Failed to send")
      }
      toast.success(`${stageLabel} email sent to ${data.email_to}`)
      trackEvent("chase_sent", { stage, ref: inv.ref })

      // Server handles chase_stage advancement — just refresh
      const { data: logs } = await supabase
        .from("chase_log")
        .select("*")
        .eq("invoice_id", inv.id)
        .order("sent_at", { ascending: false })
      if (logs) setChaseLogs(logs)
      onUpdate()
    } catch (e) {
      setError("Failed to send chase email: " + e.message)
    }
    setSending(false)
  }

  const toggleAutoChase = async () => {
    const newVal = !autoChase
    if (!newVal && !(await confirm({
      title: "Pause chasing for this invoice?",
      message: "Hielda will stop emailing you about it. Your client won't hear from Hielda either. You can resume any time.",
      confirmLabel: "Pause chasing",
      cancelLabel: "Keep chasing",
    }))) return
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
        toast.success(`Chase restarted — sent ${getStageLabel(stage)} to ${data.email_to}`)
      } else {
        toast.success(`Resent ${getStageLabel(stage)} to ${data.email_to}`)
      }

      const { data: logs } = await supabase.from("chase_log").select("*").eq("invoice_id", inv.id).order("sent_at", { ascending: false })
      if (logs) setChaseLogs(logs)
      onUpdate()
    } catch (e) {
      setError("Failed to resend: " + e.message)
    }
    setResending(false)
  }

  // Writes one payment to the ledger and settles the invoice state.
  // `settle` closes the invoice even though less than the full debt
  // (invoice + late charges) has been received — a deliberate write-off.
  const commitPayment = async (amount, paidOn, settle) => {
    setSavingPartial(true)
    setError("")
    try {
      // Ledger first — the dated record is the source of truth. Timing
      // matters legally: payments dated on/before the due date reduce the
      // debt that went overdue, which sets the fixed-fee tier.
      const { error: ledgerErr } = await supabase.from("invoice_payments").insert({
        invoice_id: inv.id,
        user_id: profile.id,
        amount,
        paid_on: paidOn,
      })
      if (ledgerErr) throw ledgerErr

      const newPaid = round2((Number(inv.amount_paid) || 0) + amount)
      // "Fully paid" means the whole debt — invoice AND the late charges
      // Hielda has been demanding. Comparing against the face value alone
      // closed invoices the client had underpaid (the charges vanished).
      const owedNow = Math.max(0, tot)
      const coversAll = amount >= owedNow - 0.005
      const closing = coversAll || settle
      const updates = { amount_paid: newPaid }
      if (paidOn <= inv.due_date) {
        updates.paid_before_due = round2((Number(inv.paid_before_due) || 0) + amount)
      }
      if (closing) {
        updates.status = "paid"
        updates.paid_date = paidOn
        updates.chase_stage = null
      }
      const { error: err } = await supabase.from("invoices").update(updates).eq("id", inv.id)
      if (err) throw err
      setShowPartialPayment(false)
      setPartialAmount("")
      setPartialDate(todayStr())
      setSettleShort(false)
      setSettlePrompt(null)
      // amount_paid above the invoice total is money Hielda's late charges
      // brought in — worth celebrating by name.
      const chargesCollected = round2(Math.max(0, newPaid - invoiceTotal))
      if (settle && !coversAll) {
        trackEvent("invoice_settled_short", { ref: inv.ref, received: newPaid, written_off: round2(owedNow - amount) })
        toast.success(`Settled for ${fmt(newPaid)} — ${fmt(round2(owedNow - amount))} written off`)
      } else if (coversAll) {
        trackEvent("invoice_paid", { amount: Number(inv.amount), ref: inv.ref })
        toast.success(chargesCollected > 0
          ? `Paid in full — including ${fmt(chargesCollected)} in late charges Hielda won for you`
          : "Invoice fully paid!")
      } else {
        toast.success(`Recorded ${fmt(amount)} paid on ${formatDate(paidOn)}`)
      }
      onUpdate()
    } catch (e) {
      setError("Failed to record payment: " + e.message)
    }
    setSavingPartial(false)
  }

  const recordPartialPayment = async () => {
    const amount = parseFloat(partialAmount)
    if (!amount || amount <= 0) return
    const owedNow = Math.max(0, tot)
    const faceRem = Math.max(0, round2(invoiceTotal - paidSoFar))
    // Guard against fat-fingered overpayments: the cap is the whole debt
    // including late charges — a client paying invoice + charges is normal
    // and must be recordable, but more than that belongs elsewhere.
    if (amount > owedNow + 0.005) {
      setError(
        `That's more than the ${fmt(owedNow)} owed on this invoice including late charges. ` +
        `Check you're on the right invoice — or record ${fmt(owedNow)} here and the rest against the correct one.`
      )
      return
    }
    const paidOn = partialDate || todayStr()
    if (paidOn > todayStr()) {
      setError("The payment date can't be in the future.")
      return
    }
    // Covers the invoice but only part of the late charges — the most
    // common "nearly there" payment. Lay out the split and let the user
    // decide: keep chasing the shortfall, or call it settled.
    if (amount > faceRem + 0.005 && amount < owedNow - 0.005) {
      setSettlePrompt({
        amount,
        paidOn,
        faceRem,
        towardCharges: round2(amount - faceRem),
        remainder: round2(owedNow - amount),
      })
      return
    }
    await commitPayment(amount, paidOn, settleShort && amount < owedNow - 0.005)
  }

  // Undo a recorded payment — the escape hatch for "wrong amount" or
  // "wrong invoice". Totals are recomputed from the remaining ledger rows
  // (the ledger is the source of truth), and an invoice that was auto-marked
  // paid by the deleted payment reopens as pending; App.jsx re-derives
  // 'overdue' from the due date.
  const deletePayment = async (p) => {
    if (!(await confirm({
      title: `Remove this ${fmt(p.amount)} payment?`,
      message: `The payment recorded for ${formatDate(p.paid_on)} will be removed and the outstanding balance recalculated.${inv.status === "paid" ? "\n\nThe invoice will reopen as unpaid. Your client will NOT be chased automatically — Hielda always checks with you first." : ""}`,
      confirmLabel: "Remove payment",
      cancelLabel: "Keep it",
      danger: true,
    }))) return
    setSavingPartial(true)
    setError("")
    try {
      const { error: delErr } = await supabase.from("invoice_payments").delete().eq("id", p.id)
      if (delErr) throw delErr
      const remaining = payments.filter((x) => x.id !== p.id)
      const newPaid = round2(remaining.reduce((sum, x) => sum + Number(x.amount), 0))
      const newBeforeDue = round2(
        remaining.filter((x) => x.paid_on <= inv.due_date).reduce((sum, x) => sum + Number(x.amount), 0)
      )
      const updates = { amount_paid: newPaid, paid_before_due: newBeforeDue }
      if (inv.status === "paid" && newPaid < Number(inv.amount)) {
        updates.status = "pending"
        updates.paid_date = null
      }
      const { error: err } = await supabase.from("invoices").update(updates).eq("id", inv.id)
      if (err) throw err
      setPayments(remaining)
      trackEvent("payment_removed", { ref: inv.ref, amount: Number(p.amount) })
      toast.success(`Removed ${fmt(p.amount)} payment — ${fmt(round2(Number(inv.amount) - newPaid))} now outstanding`)
      onUpdate()
    } catch (e) {
      setError("Failed to remove payment: " + e.message)
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

      {/* Action buttons.
          On mobile, only the primary "Paid" action and the More menu
          show up front — Edit / Part Paid / Dispute live inside the
          More menu so the row doesn't wrap into a messy 2-line
          tangle on a 375px screen. Desktop keeps all actions visible
          for fast access. */}
      <div className={isMobile ? s.actionRowMobile : s.actionRow}>
        {/* Primary action: Mark Paid — always visible on both desktop and mobile */}
        {inv.status !== "paid" && (
          <Btn v="successAction" onClick={markPaid} dis={marking} sz={isMobile ? "sm" : undefined}>
            {marking ? "..." : <><Check size={14} strokeWidth={2.5} /> Paid</>}
          </Btn>
        )}
        {!isMobile && inv.status !== "paid" && (
          <Btn v="ghost" onClick={() => {
            try { localStorage.setItem("hielda_edit", JSON.stringify(inv)) } catch {}
            navigate("/create")
          }} sz="sm">
            <Pencil size={13} /> Edit
          </Btn>
        )}
        {!isMobile && inv.status !== "paid" && (
          <Btn v="ghost" onClick={() => setShowPartialPayment(v => !v)} sz="sm">
            <Wallet size={13} /> Part paid
          </Btn>
        )}
        {!isMobile && inv.status !== "paid" && !isDisputed && (
          <Btn v="ghost" onClick={() => setShowDisputeModal(true)} dis={disputing} sz="sm" style={{ color: "#7c3aed", borderColor: "#7c3aed40" }}>
            <Flag size={13} /> Dispute
          </Btn>
        )}
        {!isMobile && isDisputed && (
          <Btn v="ghost" onClick={() => setShowResolveModal(true)} dis={disputing} sz="sm" style={{ color: "#7c3aed", borderColor: "#7c3aed40" }}>
            {disputing ? "..." : <><RotateCcw size={13} /> Resolve</>}
          </Btn>
        )}

        {/* Download is promoted out of the More menu — it's one of the
            most-used actions (accountant handoff, archive, email forward)
            and doesn't belong buried in a list of 10 items. */}
        <Btn v="ghost" onClick={downloadPdf} dis={downloading} sz="sm">
          <Download size={13} /> {isMobile ? "" : "Download"}
        </Btn>

        {/* More menu */}
        <div className={s.moreWrap}>
          <Btn v="ghost" onClick={() => setShowMore(v => !v)} sz="sm">
            <MoreHorizontal size={14} /> More
          </Btn>
          {showMore && (
            <>
              {/* Backdrop: invisible on desktop (just for click-outside),
                  dimmed on mobile where the menu is a bottom sheet. */}
              <div
                onClick={() => setShowMore(false)}
                className={isMobile ? s.sheetBackdrop : s.moreBackdrop}
              />
              <div className={isMobile ? s.bottomSheet : s.moreMenu} role="menu">
                {isMobile && (
                  <div className={s.sheetHandle} aria-hidden="true" />
                )}
                {isMobile && (
                  <div className={s.sheetTitle}>Invoice actions</div>
                )}

                {/* ── This invoice ── */}
                <div className={s.menuSectionLabel}>This invoice</div>
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
                  <div className={s.menuBtnLabel}><Copy size={14} /> Clone invoice</div>
                  <div className={s.menuBtnSub}>Start a new invoice with these client and line item details</div>
                </button>
                {isMobile && inv.status !== "paid" && (
                  <button onClick={() => {
                    setShowMore(false)
                    try { localStorage.setItem("hielda_edit", JSON.stringify(inv)) } catch {}
                    navigate("/create")
                  }} className={s.menuBtn}>
                    <div className={s.menuBtnLabel}><Pencil size={14} /> Edit invoice</div>
                    <div className={s.menuBtnSub}>Change client details, line items or anything else</div>
                  </button>
                )}

                {/* ── Email ── */}
                <div className={s.menuDivider} />
                <div className={s.menuSectionLabel}>Email</div>
                {inv.status !== "paid" && inv.client_email && (
                  <button onClick={() => { setShowMore(false); sendInvoiceEmail() }} disabled={sendingInvoiceEmail} className={s.menuBtn}>
                    <div className={s.menuBtnLabel}><Mail size={14} /> {sendingInvoiceEmail ? "Sending..." : "Send invoice email"}</div>
                    <div className={s.menuBtnSub}>Sends the introduction + invoice details to {inv.client_name}</div>
                  </button>
                )}
                {inv.status !== "paid" && inv.client_email && (
                  <button onClick={() => { setShowMore(false); sendChaseEmail() }} disabled={sending} className={s.menuBtn}>
                    <div className={s.menuBtnLabel}><Send size={14} /> Send chase</div>
                    <div className={s.menuBtnSub}>Next: {getStageLabel(currentSendStage)}</div>
                  </button>
                )}
                {inv.status !== "paid" && inv.client_email && (
                  <button onClick={() => { setShowMore(false); showEmailPreview() }} className={s.menuBtn}>
                    <div className={s.menuBtnLabel}><Eye size={14} /> Preview chase email</div>
                    <div className={s.menuBtnSub}>See exactly what your client will receive</div>
                  </button>
                )}
                <button onClick={() => { setShowMore(false); sendCopyToSelf() }} disabled={sendingInvoiceEmail} className={s.menuBtn}>
                  <div className={s.menuBtnLabel}><Forward size={14} /> {sendingInvoiceEmail ? "Sending..." : "Email me a copy"}</div>
                  <div className={s.menuBtnSub}>Send this invoice's details to your own email (not your client)</div>
                </button>
                {inv.status !== "paid" && !inv.client_email && (
                  <div className={s.menuNoEmail}>
                    No client email — chase unavailable
                  </div>
                )}

                {/* ── Status ── */}
                {inv.status !== "paid" && (
                  <>
                    <div className={s.menuDivider} />
                    <div className={s.menuSectionLabel}>Status</div>
                    <button onClick={() => { setShowMore(false); setNewDueDate(inv.due_date); setShowAdjustDue(true) }} className={s.menuBtn}>
                      <div className={s.menuBtnLabel}><Calendar size={14} /> Adjust due date</div>
                      <div className={s.menuBtnSub}>Change when interest starts accruing (currently {formatDate(inv.due_date)})</div>
                    </button>
                  </>
                )}
                {isMobile && inv.status !== "paid" && (
                  <button onClick={() => { setShowMore(false); setShowPartialPayment(true) }} className={s.menuBtn}>
                    <div className={s.menuBtnLabel}><Wallet size={14} /> Record partial payment</div>
                    <div className={s.menuBtnSub}>If your client has paid some but not all of the invoice</div>
                  </button>
                )}
                {isMobile && inv.status !== "paid" && !isDisputed && (
                  <button onClick={() => { setShowMore(false); setShowDisputeModal(true) }} className={s.menuBtn} style={{ color: "#7c3aed" }}>
                    <div className={s.menuBtnLabel}><Flag size={14} /> Mark as disputed</div>
                    <div className={s.menuBtnSub}>Pause chasing while you sort it out with your client</div>
                  </button>
                )}
                {isMobile && isDisputed && (
                  <button onClick={() => { setShowMore(false); setShowResolveModal(true) }} className={s.menuBtn} style={{ color: "#7c3aed" }}>
                    <div className={s.menuBtnLabel}><RotateCcw size={14} /> Resolve dispute</div>
                    <div className={s.menuBtnSub}>Mark the dispute as settled</div>
                  </button>
                )}

                {/* ── Delete (bottom) ── */}
                <div className={s.menuDivider} />
                <button onClick={() => { setShowMore(false); deleteInvoice() }} disabled={deleting} className={s.menuBtnDanger}>
                  <div className={s.menuBtnLabel}><Trash2 size={14} /> Delete invoice</div>
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
      {showPartialPayment && inv.status !== "paid" && (() => {
        const owedNow = Math.max(0, tot)
        const faceRem = Math.max(0, round2(invoiceTotal - paidSoFar))
        const amt = parseFloat(partialAmount) || 0
        const settlesAll = amt >= owedNow - 0.005 && amt > 0
        const canSettleShort = amt > 0 && !settlesAll && amt <= faceRem + 0.005
        return (
        <div className={s.partialForm}>
          <div className={s.partialFormTitle}>Record a payment</div>
          <div className={s.partialFormInfo}>
            {amountPaid > 0 && <>Already received: <strong>{fmt(amountPaid)}</strong> · </>}
            Invoice: <strong>{fmt(faceRem)}</strong>
            {owedNow > faceRem && <> + late charges: <strong>{fmt(round2(owedNow - faceRem))}</strong> · Total owed: <strong>{fmt(owedNow)}</strong></>}
          </div>
          <div className={s.partialFormRow}>
            <input
              type="number"
              value={partialAmount}
              onChange={e => setPartialAmount(e.target.value)}
              placeholder={`Up to ${fmt(owedNow)}`}
              step="0.01"
              max={owedNow}
              className={s.partialInput}
            />
            <Btn sz="sm" onClick={recordPartialPayment} dis={savingPartial || !partialAmount || parseFloat(partialAmount) <= 0}>
              {savingPartial ? "..." : canSettleShort && settleShort ? "Settle" : "Record"}
            </Btn>
            <button onClick={() => { setShowPartialPayment(false); setSettleShort(false) }} className={s.cancelBtn}>Cancel</button>
          </div>
          {/* When the money actually arrived — backdatable, because most
              people record a payment days after it lands. If it arrived
              before the due date it reduces the debt that went overdue,
              which can lower the fixed recovery fee tier. */}
          <div className={s.partialDateRow}>
            <label className={s.partialDateLabel} htmlFor="partialPaidOn">When was it paid?</label>
            <input
              id="partialPaidOn"
              type="date"
              value={partialDate}
              onChange={e => setPartialDate(e.target.value)}
              max={todayStr()}
              className={s.partialDateInput}
            />
            {partialDate && partialDate <= inv.due_date && (
              <span className={s.partialDateHint}>Before the due date — this reduces the late charges your client owes.</span>
            )}
          </div>
          {settlesAll && (
            <div className={s.partialFullNote}>
              This settles the invoice in full{owedNow > faceRem ? ", including all late charges" : ""}.
            </div>
          )}
          {canSettleShort && (
            <label className={s.settleShortRow}>
              <input
                type="checkbox"
                checked={settleShort}
                onChange={e => setSettleShort(e.target.checked)}
              />
              <span>
                Accept as <strong>full &amp; final settlement</strong> — write off the remaining {fmt(round2(owedNow - amt))} and close the invoice
              </span>
            </label>
          )}
        </div>
        )
      })()}

      {/* Payment covers the invoice but only part of the late charges —
          lay out the split and let the user choose: chase or settle. */}
      {settlePrompt && (
        <div className={s.settleOverlay} role="presentation" onClick={() => setSettlePrompt(null)}>
          <div
            className={s.settleBox}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settle-prompt-title"
            onClick={e => e.stopPropagation()}
          >
            <h3 className={s.settleTitle} id="settle-prompt-title">This covers the invoice — but not all the late charges</h3>
            <div className={s.settleRows}>
              <div className={s.settleRow}><span>You've been paid</span><strong>{fmt(settlePrompt.amount)}</strong></div>
              <div className={s.settleRow}><span>Your original invoice</span><span>{fmt(settlePrompt.faceRem)}</span></div>
              <div className={s.settleRow}><span>Towards fines &amp; interest</span><span style={{ color: c.gn }}>+{fmt(settlePrompt.towardCharges)}</span></div>
              <div className={`${s.settleRow} ${s.settleRowTotal}`}><span>Still unpaid</span><strong>{fmt(settlePrompt.remainder)}</strong></div>
            </div>
            <p className={s.settleHint}>
              Do you want to keep chasing the remaining {fmt(settlePrompt.remainder)}, or are you happy to accept this and call it settled?
            </p>
            <div className={s.settleActions}>
              <button onClick={() => setSettlePrompt(null)} className={s.cancelBtn}>Cancel</button>
              <Btn v="ghost" sz="sm" onClick={() => commitPayment(settlePrompt.amount, settlePrompt.paidOn, false)} dis={savingPartial}>
                Keep chasing {fmt(settlePrompt.remainder)}
              </Btn>
              <Btn sz="sm" onClick={() => commitPayment(settlePrompt.amount, settlePrompt.paidOn, true)} dis={savingPartial}>
                {savingPartial ? "..." : "Settle — write it off"}
              </Btn>
            </div>
          </div>
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
          {payments.length > 0 && (
            <div className={s.paymentHistory}>
              {payments.map((p) => (
                <div key={p.id} className={s.paymentHistoryRow}>
                  <span>{fmt(p.amount)}</span>
                  <span className={s.paymentHistoryDate}>
                    {formatDate(p.paid_on)}{p.paid_on <= inv.due_date ? " · before due date" : ""}
                  </span>
                  <button
                    className={s.paymentUndoBtn}
                    onClick={() => deletePayment(p)}
                    disabled={savingPartial}
                    aria-label={`Remove ${fmt(p.amount)} payment`}
                    title="Remove this payment"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
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
          <div className={s.extrasRight}>
            <div className={isMobile ? s.extrasAmountMobile : s.extrasAmount}>+{fmt(ex)}</div>
            {/* One-tap waive, right where the charges are shown — the full
                toggle with explanation lives further down in settings, but
                users shouldn't have to hunt for it. */}
            <button
              onClick={async () => {
                if (!(await confirm({
                  title: "Stop charging fines & interest on this invoice?",
                  message: `The ${fmt(ex)} currently added will be removed and chase emails will stop mentioning charges. Hielda keeps chasing the invoice itself. You can turn them back on any time.`,
                  confirmLabel: "Turn off charges",
                  cancelLabel: "Keep charging",
                }))) return
                toggleNoFines()
              }}
              className={s.extrasWaiveBtn}
            >
              Don't charge these
            </button>
          </div>
        </div>
      )}

      {/* Unagreed short terms: the user asked for faster payment but the
          client never agreed shorter terms, so the enforceable due date is
          the 30-day statutory default and the early date was a polite ask. */}
      {inv.status !== "paid" && inv.terms_agreed === false && inv.requested_term_days && (
        <div className={s.finesOffBar}>
          <span className={s.finesOffText}>
            You asked for payment in {inv.requested_term_days} days (a polite request in the intro email) — the enforceable due date is {formatDate(inv.due_date)}, the legal 30-day default, since shorter terms weren't agreed with the client.
          </span>
        </div>
      )}

      {/* Auto-chase toggle. The old subtitle said "Hielda will send chase
          emails automatically" — technically misleading because chases
          only fire after the freelancer approves via the check-in email.
          Reworded to reflect what actually happens, which also doubles
          as reassurance for users worried about their client being
          hassled. */}
      {inv.status !== "paid" && (
        <div className={`${isMobile ? s.toggleRowMobile : s.toggleRow} ${s.autoChaseMargin}`}>
          <div className={s.toggleContent}>
            <div className={s.toggleTitle}>Automatic chasing</div>
            <div className={s.toggleSub}>
              {autoChase
                ? "When a chase is due, Hielda emails you first to ask — nothing goes to your client without your approval."
                : "Paused. Hielda won't email you or your client about this invoice."}
            </div>
          </div>
          <button
            onClick={toggleAutoChase}
            className={s.toggleTrack}
            style={{ background: autoChase ? c.ac : c.bd }}
            aria-label={autoChase ? "Pause automatic chasing" : "Resume automatic chasing"}
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
                ? "Statutory interest and a fixed debt recovery cost will be applied when overdue"
                : "Chase emails won't include fines or interest — chasing only"}
            </div>
            {showFinesInfo && (
              <div className={s.finesInfoPanel}>
                <strong>On:</strong> Overdue chase emails include statutory interest and a fixed debt recovery cost under the Late Payment Act 1998.<br />
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
          {inv.notes && (
            <div className={s.notesBlock}>
              <div className={s.notesLabel}>Notes</div>
              <div className={s.notesBody}>{inv.notes}</div>
            </div>
          )}
        </Card>

        {ov && (
          <Card>
            <h3 className={s.oweHeading}>What they now owe you</h3>
            <div className={s.oweLaw}>Statement · Late Payment of Commercial Debts (Interest) Act 1998</div>
            {[
              [hasVat ? "Invoice (inc. VAT)" : "Original invoice", fmt(invoiceTotal), c.tx],
              ...(paidSoFar > 0 ? [["Payments received", `−${fmt(paidSoFar)}`, c.gn]] : []),
              ["Fixed debt recovery cost", `+${fmt(pen)}`, c.go],
              [`Interest (${dl}d${paidSoFar > 0 ? " on balance" : ""})`, `+${fmt(interest)}`, c.go],
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
            {/* The stamp — the authority that marks the account settled.
                SETTLED when the close was negotiated short of the full
                debt, PAID otherwise. */}
            <div className={s.paidStamp}>
              {amountPaid > 0 && amountPaid < invoiceTotal - 0.005 ? "Settled" : "Paid"}
            </div>
            <div className={s.paidDate}>{formatDate(inv.paid_date)}</div>
            {/* What actually happened at settlement: money above the invoice
                total is late charges Hielda collected; money below it was
                deliberately written off when settling short. */}
            {amountPaid > invoiceTotal + 0.005 && (
              <div className={s.paidChargesNote}>
                Including <strong>{fmt(round2(amountPaid - invoiceTotal))}</strong> in late charges Hielda won for you
              </div>
            )}
            {amountPaid > 0 && amountPaid < invoiceTotal - 0.005 && (
              <div className={s.paidSettledNote}>
                Settled for {fmt(amountPaid)} — {fmt(round2(invoiceTotal - amountPaid))} written off
              </div>
            )}
            {/* Payment history stays visible after the invoice closes —
                a mis-recorded payment is usually noticed only once the
                invoice has wrongly gone green, so the undo must live here. */}
            {payments.length > 0 && (
              <div className={s.paymentHistory} style={{ textAlign: "left", marginTop: 12 }}>
                {payments.map((p) => (
                  <div key={p.id} className={s.paymentHistoryRow}>
                    <span>{fmt(p.amount)}</span>
                    <span className={s.paymentHistoryDate}>{formatDate(p.paid_on)}</span>
                    <button
                      className={s.paymentUndoBtn}
                      onClick={() => deletePayment(p)}
                      disabled={savingPartial}
                      aria-label={`Remove ${fmt(p.amount)} payment`}
                      title="Remove this payment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Btn v="ghost" sz="sm" onClick={unmarkPaid} dis={marking} style={{ marginTop: 12 }}>
              {marking ? "..." : "Mark as unpaid"}
            </Btn>
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


      {/* CC / BCC recipients */}
      {inv.status !== "paid" && (
        <Card style={{ marginTop: 0, marginBottom: 16 }}>
          <h3 className={s.recipientsHeading}>Email recipients</h3>
          <p className={s.recipientsDesc}>You're always BCC'd automatically (your client won't see you on the recipient list). Add others below.</p>
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
          <p style={{ fontSize: 12, color: "var(--tm)", margin: "0 0 14px", lineHeight: 1.6 }}>
            Every email Hielda has sent for this invoice — check-ins to you, and any chases you approved going to your client.
          </p>
          {chaseLogs.map((log) => {
            const stg = CHASE_STAGES.find((s) => s.id === log.chase_stage)
            const isCheckIn = log.status === "check_in_sent"
            const isMarkedPaid = log.status === "marked_paid_via_check_in"
            const isStatement = log.status === "statement_sent"
            const statusLabel = isCheckIn
              ? `Check-in: ${stg?.label || log.chase_stage}`
              : isMarkedPaid
              ? "Marked paid via check-in"
              : isStatement
              ? "Consolidated statement"
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
                <div className={isMobile ? s.chaseLogDateMobile : s.chaseLogDate} title={new Date(log.sent_at).toString()}>
                  {formatDate(log.sent_at)} · {new Date(log.sent_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
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
                onClick={() => { setPreviewHtml(null); sendChaseEmail({ skipConfirm: true }) }}
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
      {showAdjustDue && (
        <div className={isMobile ? s.modalOverlayMobile : s.modalOverlay} onClick={() => !adjusting && setShowAdjustDue(false)}>
          <div className={isMobile ? s.modalBoxMobile : s.modalBox} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className={s.modalHeader}>
              <span className={s.modalTitle}>Adjust due date</span>
              <button onClick={() => setShowAdjustDue(false)} className={s.modalCloseBtn} disabled={adjusting}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: "var(--tm)", margin: "0 0 16px", lineHeight: 1.6 }}>
                The due date sets when statutory interest starts accruing. Change it here if the original terms were wrong (eg you picked 7 days by mistake but actually agreed 30 with the client).
              </p>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--tm)", marginBottom: 6 }}>New due date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--bd)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: "var(--bg)" }}
              />
              {newDueDate && newDueDate !== inv.due_date && (
                <div style={{ marginTop: 14, fontSize: 12, color: "var(--tm)", background: "var(--acd)", border: "1px solid var(--bdl)", borderRadius: 8, padding: "10px 12px", lineHeight: 1.6 }}>
                  {new Date(newDueDate) > new Date()
                    ? "✓ Invoice will return to 'pending'. No interest currently applies."
                    : "Interest will accrue from this date forward at the statutory rate."}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
                <Btn v="ghost" sz="sm" onClick={() => setShowAdjustDue(false)} dis={adjusting}>Cancel</Btn>
                <Btn sz="sm" onClick={adjustDueDate} dis={adjusting || !newDueDate || newDueDate === inv.due_date}>
                  {adjusting ? "Saving..." : "Update due date"}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
