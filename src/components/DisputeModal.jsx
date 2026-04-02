import { useState } from "react"
import { Btn, Inp, Sel } from "./ui"
import s from "./DisputeModal.module.css"

const REASONS = [
  { l: "Work quality", v: "work_quality" },
  { l: "Amount incorrect", v: "amount_incorrect" },
  { l: "Already paid", v: "already_paid" },
  { l: "Other", v: "other" },
]

export default function DisputeModal({ invoice, onConfirm, onClose }) {
  const [reason, setReason] = useState("work_quality")
  const [notes, setNotes] = useState("")
  const [sendEmail, setSendEmail] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    await onConfirm({ reason, notes, sendEmail })
    setSubmitting(false)
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={s.title}>Mark as Disputed</h2>
        <p className={s.desc}>
          Chasing will be paused for <strong>{invoice.ref}</strong> ({invoice.client_name}) while the dispute is reviewed.
        </p>

        <Sel
          label="Dispute reason"
          value={reason}
          onChange={setReason}
          opts={REASONS}
        />

        <Inp
          label="Notes (optional)"
          value={notes}
          onChange={setNotes}
          ta
          ph="What happened? Any context that will help when you come back to this..."
        />

        <div className={s.emailToggle}>
          <label className={s.checkLabel}>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className={s.check}
            />
            Send acknowledgement email to {invoice.client_email}
          </label>
          <p className={s.emailHint}>
            A professional email confirming the dispute and that chasing is paused.
          </p>
        </div>

        <div className={s.actions}>
          <Btn onClick={handleSubmit} dis={submitting}>
            {submitting ? "Saving..." : "Mark Disputed"}
          </Btn>
          <Btn v="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  )
}
