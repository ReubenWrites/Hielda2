import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import { colors as c, MONO, RATE, CHASE_STAGES, DAILY_RATE, FONT } from "../constants"
import { daysLate, calcInterest, penalty, fmt, formatDate, addDays } from "../utils"
import { Card, Badge, Btn, ErrorBanner } from "./ui"
import { buildChaseEmail } from "../lib/emailTemplates"

const STAGE_ORDER = ["reminder_1", "reminder_2", "final_warning", "first_chase", "second_chase", "third_chase", "chase_4", "chase_5", "chase_6", "chase_7", "chase_8", "chase_9", "chase_10", "chase_11", "escalation_1", "escalation_2", "escalation_3", "escalation_4", "final_notice"]

function getNextStage(currentStage) {
  if (!currentStage) return "reminder_1"
  const idx = STAGE_ORDER.indexOf(currentStage)
  if (idx === -1) return "reminder_1"
  if (idx >= STAGE_ORDER.length - 1) return null // already at final_notice
  return STAGE_ORDER[idx + 1]
}

function getStageToBeSent(invoice) {
  // The stage to send is the current stage if nothing has been sent yet,
  // otherwise the next stage after the current one
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

  // Auto-expand the group containing the current stage
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
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: allPast ? c.gn : somePast ? c.tx : c.td, fontSize: 12 }}>{group.label}</span>
                  {isCurrentGroup && <Badge color={group.col}>Active</Badge>}
                  <span style={{ fontSize: 10, color: c.td, marginLeft: "auto" }}>{groupStages.length} {groupStages.length === 1 ? "email" : "emails"}</span>
                </div>
                <div style={{ fontSize: 10, color: c.td, marginTop: 2 }}>{dateRange}</div>
              </div>
              <span style={{ fontSize: 11, color: c.td, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
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
                      <span style={{ fontSize: 10, color: c.td, fontFamily: MONO }}>
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

export default function Detail({ inv, nav, profile, onUpdate }) {
  const [marking, setMarking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [downloading, setDownloading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState(null)
  const [chaseLogs, setChaseLogs] = useState([])
  const [autoChase, setAutoChase] = useState(inv?.auto_chase !== false)
  const [sending, setSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState("")
  const [sendingCheckIn, setSendingCheckIn] = useState(false)

  // Load chase logs for this invoice
  useEffect(() => {
    if (!inv?.id) return
    setAutoChase(inv.auto_chase !== false)
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
  const finesEnabled = !inv.no_fines
  const interest = ov && finesEnabled ? calcInterest(Number(inv.amount), dl) : 0
  const pen = ov && finesEnabled ? penalty(Number(inv.amount)) : 0
  const ex = interest + pen
  const tot = Number(inv.amount) + ex
  const si = CHASE_STAGES.findIndex((s) => s.id === inv.chase_stage)

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

    // Task 4: Confirmation dialog before sending
    const confirmed = window.confirm(
      `Send ${stageLabel} email to ${inv.client_email}?`
    )
    if (!confirmed) return

    setSending(true)
    setError("")
    setSendSuccess("")
    try {
      // Task 1: Include user token for authentication
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

      // Task 3: Advance to the next chase stage after successful send
      const nextStage = getNextStage(stage)
      if (nextStage) {
        await supabase
          .from("invoices")
          .update({ chase_stage: nextStage })
          .eq("id", inv.id)
      }

      // Refresh chase logs
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

  const sendCheckInEmail = async () => {
    const stage = currentSendStage
    const stageLabel = getStageLabel(stage)

    const confirmed = window.confirm(
      `Send a check-in email to yourself for "${stageLabel}" on invoice ${inv.ref}?\n\nYou'll receive an email asking if ${inv.client_name} has paid. You can then confirm or trigger the chase from the email.`
    )
    if (!confirmed) return

    setSendingCheckIn(true)
    setError("")
    setSendSuccess("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userToken = session?.access_token

      const res = await fetch("/api/send-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: inv.id,
          chase_stage: stage,
          user_token: userToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send check-in")
      setSendSuccess(`Check-in email sent to ${data.email_to}`)

      // Refresh chase logs
      const { data: logs } = await supabase
        .from("chase_log")
        .select("*")
        .eq("invoice_id", inv.id)
        .order("sent_at", { ascending: false })
      if (logs) setChaseLogs(logs)
      onUpdate()
      setTimeout(() => setSendSuccess(""), 5000)
    } catch (e) {
      setError("Failed to send check-in: " + e.message)
    }
    setSendingCheckIn(false)
  }

  const toggleAutoChase = async () => {
    const newVal = !autoChase
    setAutoChase(newVal)
    try {
      const { error: err } = await supabase
        .from("invoices")
        .update({ auto_chase: newVal })
        .eq("id", inv.id)
      if (err) throw err
      onUpdate()
    } catch (e) {
      setAutoChase(!newVal) // revert on error
      setError("Failed to update auto-chase: " + e.message)
    }
  }

  return (
    <div>
      <button onClick={() => nav("dash")} style={{ background: "none", border: "none", color: c.tm, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 18 }}>
        ← Back to Dashboard
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: c.tx, margin: 0 }}>{inv.ref}</h1>
            <Badge color={inv.status === "paid" ? c.gn : ov ? c.or : c.am}>
              {ov ? "being chased" : inv.status}
            </Badge>
            {inv.no_fines && <Badge color={c.td}>no fines</Badge>}
          </div>
          <p style={{ color: c.tm, margin: 0, fontSize: 13 }}>{inv.client_name} · {inv.description}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {inv.status !== "paid" && (
            <Btn v="successAction" onClick={markPaid} dis={marking}>
              {marking ? "Marking..." : "✓ Mark as Paid"}
            </Btn>
          )}
          <Btn v="ghost" onClick={downloadPdf} dis={downloading} sz="sm">
            {downloading ? "Generating..." : "📥 PDF"}
          </Btn>
          {inv.status !== "paid" && inv.client_email && (
            <Btn v="ghost" onClick={showEmailPreview} sz="sm">
              📧 Preview
            </Btn>
          )}
          {inv.status !== "paid" && inv.client_email && (
            <Btn v="ghost" onClick={sendChaseEmail} dis={sending} sz="sm">
              {sending ? "Sending..." : `📤 Send ${getStageLabel(currentSendStage)}`}
            </Btn>
          )}
          <Btn v="danger" onClick={deleteInvoice} dis={deleting} sz="sm">
            {deleting ? "Deleting..." : "🗑 Delete"}
          </Btn>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {sendSuccess && (
        <div style={{ padding: "10px 14px", background: c.gnd, color: c.gn, borderRadius: 8, fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span>✓</span> {sendSuccess}
        </div>
      )}

      {ov && ex > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", background: c.god, border: `1px solid rgba(161,98,7,0.15)`, borderLeft: "3px solid #d4a017", borderRadius: "0 12px 12px 0", marginBottom: 18 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: c.go }}>Extra added by Hielda</span>
            <span style={{ fontSize: 12, color: c.tm, marginLeft: 8 }}>penalty + {dl}d interest</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: c.go, fontFamily: MONO }}>+{fmt(ex)}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>Invoice details</h3>
          {[
            ["Client", inv.client_name],
            ["Email", inv.client_email],
            ["Original", fmt(inv.amount)],
            ["Issued", formatDate(inv.issue_date)],
            ["Terms", `${inv.payment_term_days} days`],
            ["Due", formatDate(inv.due_date)],
            inv.paid_date ? ["Paid", formatDate(inv.paid_date)] : null,
          ]
            .filter(Boolean)
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${c.bdl}` }}>
                <span style={{ color: c.tm, fontSize: 13 }}>{k}</span>
                <span style={{ color: c.tx, fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
        </Card>

        {ov && (
          <Card>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>What they now owe you</h3>
            <div style={{ fontSize: 10, color: c.td, marginBottom: 12 }}>Late Payment of Commercial Debts (Interest) Act 1998</div>
            {[
              ["Original invoice", fmt(inv.amount), c.tx],
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
              <span style={{ color: c.ac, fontSize: 20, fontWeight: 700, fontFamily: MONO }}>{fmt(tot)}</span>
            </div>
            <div style={{ fontSize: 10, color: c.td, marginTop: 5, textAlign: "right" }}>+{fmt(Number(inv.amount) * DAILY_RATE)}/day</div>
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

      {/* Auto-chase toggle */}
      {inv.status !== "paid" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 10, marginTop: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.tx }}>Automatic chasing</div>
            <div style={{ fontSize: 11, color: c.tm, marginTop: 2 }}>
              {autoChase ? "Hielda will send chase emails automatically" : "Chase emails paused for this invoice"}
            </div>
          </div>
          <button
            onClick={toggleAutoChase}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              background: autoChase ? c.ac : c.bd,
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
            aria-label={autoChase ? "Disable automatic chasing" : "Enable automatic chasing"}
          >
            <div style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#fff",
              position: "absolute",
              top: 3,
              left: autoChase ? 23 : 3,
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }} />
          </button>
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
            return (
              <div key={log.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${c.bdl}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: c.tx }}>{statusLabel}</div>
                    <div style={{ fontSize: 11, color: c.td }}>{isCheckIn ? "Sent to you" : `Sent to ${log.email_to}`}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: c.td }}>{formatDate(log.sent_at)}</div>
              </div>
            )
          })}
        </Card>
      )}

      {/* Email preview modal */}
      {previewHtml && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: c.sf, borderRadius: 14, width: 680, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${c.bd}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: c.tx }}>Chase Email Preview</span>
              <button onClick={() => setPreviewHtml(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: c.tm }}>×</button>
            </div>
            <iframe
              srcDoc={previewHtml}
              style={{ flex: 1, border: "none", minHeight: 400 }}
              title="Email preview"
            />
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${c.bd}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn v="ghost" onClick={() => setPreviewHtml(null)} sz="sm">Close</Btn>
              <Btn
                onClick={() => {
                  setPreviewHtml(null)
                  sendChaseEmail()
                }}
                dis={sending}
                sz="sm"
              >
                {sending ? "Sending..." : `📤 Send ${getStageLabel(currentSendStage)}`}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
