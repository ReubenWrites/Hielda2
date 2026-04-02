import { useState } from "react"
import { Btn, Inp, Sel } from "./ui"
import s from "./DisputeModal.module.css"

const OUTCOMES = [
  { l: "Resolved — paid in full", v: "paid" },
  { l: "Resolved — amount adjusted", v: "adjusted" },
  { l: "Resolved — written off", v: "written_off" },
]

export default function ResolveDisputeModal({ invoice, onConfirm, onClose }) {
  const [outcome, setOutcome] = useState("paid")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    await onConfirm({ outcome, notes })
    setSubmitting(false)
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={s.title}>Resolve Dispute</h2>
        <p className={s.desc}>
          How was the dispute for <strong>{invoice.ref}</strong> ({invoice.client_name}) resolved?
        </p>

        <Sel
          label="Outcome"
          value={outcome}
          onChange={setOutcome}
          opts={OUTCOMES}
        />

        <Inp
          label="Resolution notes (optional)"
          value={notes}
          onChange={setNotes}
          ta
          ph="How was this resolved? Any follow-up needed?"
        />

        <div className={s.actions}>
          <Btn onClick={handleSubmit} dis={submitting}>
            {submitting ? "Saving..." : "Resolve Dispute"}
          </Btn>
          <Btn v="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  )
}
