import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { CHASE_STAGES } from "../constants"
import { fmt, formatDate, addDays } from "../utils"
import { supabase } from "../supabase"
import { Card, Badge, Btn } from "./ui"
import { buildChaseEmail } from "../lib/emailTemplates"
import s from "./EmailQueue.module.css"

function getNextStageForInvoice(inv) {
  const currentIdx = CHASE_STAGES.findIndex((s) => s.id === inv.chase_stage)
  // If no stage yet, first stage is the next one
  if (currentIdx === -1) return CHASE_STAGES[0]
  // If at last stage, nothing more to send
  if (currentIdx >= CHASE_STAGES.length - 1) return null
  return CHASE_STAGES[currentIdx + 1]
}

function computeChaseQueue(invs) {
  const now = new Date()
  const weekFromNow = new Date(now)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  const queue = []
  for (const inv of invs) {
    if (!inv.auto_chase) continue
    if (inv.status !== "pending" && inv.status !== "overdue") continue
    if (!inv.client_email) continue

    const nextStage = getNextStageForInvoice(inv)
    if (!nextStage) continue

    // Calculate when this stage triggers: due_date + dfd days
    const triggerDate = addDays(inv.due_date, nextStage.dfd)
    if (triggerDate <= weekFromNow) {
      queue.push({
        invoice: inv,
        stage: nextStage,
        triggerDate,
        isPast: triggerDate <= now,
      })
    }
  }

  // Sort by trigger date (soonest first)
  queue.sort((a, b) => a.triggerDate - b.triggerDate)
  return queue
}

export default function EmailQueue({ invs, profile, onUpdate }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [previewId, setPreviewId] = useState(null)

  const queue = useMemo(() => computeChaseQueue(invs), [invs])

  if (queue.length === 0) return null

  const toggleAutoChase = async (inv) => {
    await supabase.from("invoices").update({ auto_chase: !inv.auto_chase }).eq("id", inv.id)
    onUpdate()
  }

  const previewItem = queue.find((q) => q.invoice.id === previewId)
  const previewEmail = previewItem
    ? buildChaseEmail(previewItem.invoice, profile, previewItem.stage.id, profile?.chase_tone)
    : null

  return (
    <div className={s.wrap}>
      <button onClick={() => setExpanded(!expanded)} className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.headerIcon}>📬</span>
          <span className={s.headerTitle}>Upcoming Emails</span>
          <span className={s.headerCount}>{queue.length}</span>
        </div>
        <span className={s.arrow} data-open={expanded ? "true" : undefined}>▼</span>
      </button>

      {expanded && (
        <div className={s.list}>
          {queue.map((item) => {
            const { invoice: inv, stage, triggerDate, isPast } = item
            return (
              <div key={`${inv.id}-${stage.id}`} className={s.item}>
                <div className={s.itemMain} onClick={() => navigate(`/invoice/${inv.id}`)}>
                  <div className={s.itemTop}>
                    <span className={s.clientName}>{inv.client_name || "Client"}</span>
                    <span className={s.ref}>{inv.ref}</span>
                  </div>
                  <div className={s.itemBottom}>
                    <Badge color={stage.col}>{stage.label}</Badge>
                    <span className={s.date}>
                      {isPast ? "Ready to send" : formatDate(triggerDate)}
                    </span>
                    <span className={s.amount}>{fmt(inv.amount)}</span>
                  </div>
                </div>
                <div className={s.itemActions}>
                  <button
                    onClick={() => setPreviewId(previewId === inv.id ? null : inv.id)}
                    className={s.previewBtn}
                  >
                    👁
                  </button>
                  <button
                    onClick={() => toggleAutoChase(inv)}
                    className={s.pauseBtn}
                    title="Pause auto-chase for this invoice"
                  >
                    ⏸
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {previewEmail && (
        <div className={s.previewOverlay} onClick={() => setPreviewId(null)}>
          <div className={s.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={s.previewHeader}>
              <div>
                <div className={s.previewSubject}>{previewEmail.subject}</div>
                <div className={s.previewTo}>To: {previewItem.invoice.client_email}</div>
              </div>
              <button onClick={() => setPreviewId(null)} className={s.previewClose}>×</button>
            </div>
            <iframe
              srcDoc={previewEmail.html}
              title="Email preview"
              className={s.previewFrame}
            />
          </div>
        </div>
      )}
    </div>
  )
}
