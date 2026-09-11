import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Copy, Check, Printer, Send } from "lucide-react"
import { getRate, getDailyRate, lbaResponseDays } from "../constants"
import { fmt, formatDate, round2, penalty, accruedInterest, outstanding, daysLate, addDays, todayStr } from "../utils"
import { Card, Btn, useToast } from "./ui"
import { supabase } from "../supabase"
import { trackEvent } from "../posthog"
import s from "./LetterBeforeAction.module.css"

/**
 * Letter Before Action, drafted from a real invoice.
 *
 * This is deliberately not the public /late-payment-letter-template tool.
 * That one is a formal chaser for anyone who lands on the site. This is the
 * actual pre-action step: it names the deadline, states the consequence of
 * ignoring it, invites a dispute or a payment proposal, and says it will be
 * shown to the court. Sending it is what the court expects to have happened
 * before a claim is issued.
 */
export default function LetterBeforeAction({ inv, profile, onUpdate }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [soleTrader, setSoleTrader] = useState(inv?.client_entity === "sole_trader")

  // The ledger drives the interest figure. Without it we'd quote the flat
  // approximation in a letter that may end up in front of a judge.
  const [payments, setPayments] = useState([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!inv?.id) return
    ;(async () => {
      const { data } = await supabase
        .from("invoice_payments").select("amount, paid_on")
        .eq("invoice_id", inv.id).order("paid_on", { ascending: true })
      setPayments(data || [])
      setLoaded(true)
    })()
  }, [inv?.id])

  useEffect(() => { trackEvent("lba_draft_opened", { invoice_id: inv?.id }) }, [inv?.id])

  const days = lbaResponseDays({ client_entity: soleTrader ? "sole_trader" : "company" })
  const deadline = addDays(new Date(), days)

  const figures = useMemo(() => {
    const face = Number(inv.amount) || 0
    const paid = Number(inv.amount_paid) || 0
    const owed = outstanding(inv)
    const finesOn = !inv.no_fines && inv.client_type !== "consumer"
    const debtAtDue = round2(Math.max(0, face - (Number(inv.paid_before_due) || 0)))
    const interest = finesOn ? accruedInterest(inv, loaded ? payments : undefined) : 0
    const fee = finesOn && owed > 0 && debtAtDue > 0 ? penalty(debtAtDue) : 0
    const perDay = finesOn ? round2(owed * getDailyRate()) : 0
    return { face, paid, owed, interest, fee, perDay, total: round2(owed + interest + fee) }
  }, [inv, payments, loaded])

  const dl = daysLate(inv.due_date)

  const letter = useMemo(() => {
    const v = (val, ph) => val || ph
    const L = []
    L.push(v(profile?.business_name || profile?.full_name, "[Your name]"))
    if (profile?.address) L.push(...String(profile.address).split("\n").map((x) => x.trim()).filter(Boolean))
    if (profile?.email) L.push(profile.email)
    L.push("", formatDate(new Date().toISOString()), "")
    L.push(v(inv.client_name, "[Client name]"))
    if (inv.client_address) L.push(...String(inv.client_address).split("\n").map((x) => x.trim()).filter(Boolean))
    L.push("", "LETTER BEFORE ACTION", "")
    L.push(`Re: Unpaid invoice ${inv.ref}`, "")
    L.push("Dear Sir or Madam,", "")
    L.push(
      `I am writing regarding invoice ${inv.ref}${inv.issue_date ? `, dated ${formatDate(inv.issue_date)}` : ""}, in the sum of ${fmt(figures.face)}${inv.description ? ` in respect of ${inv.description}` : ""}. Payment fell due on ${formatDate(inv.due_date)} and the invoice remains unpaid${dl > 0 ? `, now ${dl} days beyond its due date` : ""}.`,
      "",
    )
    L.push("THE SUM CLAIMED", "")
    L.push(`  Invoice ${inv.ref}${" ".repeat(Math.max(1, 28 - inv.ref.length))}${fmt(figures.face)}`)
    if (figures.paid > 0) L.push(`  Less payments received              -${fmt(figures.paid)}`)
    if (figures.fee > 0) L.push(`  Fixed debt recovery cost             ${fmt(figures.fee)}`)
    if (figures.interest > 0) L.push(`  Statutory interest to date           ${fmt(figures.interest)}`)
    L.push(`  TOTAL NOW DUE                        ${fmt(figures.total)}`, "")
    if (figures.fee > 0 || figures.interest > 0) {
      L.push(
        `The fixed sum and interest are claimed under the Late Payment of Commercial Debts (Interest) Act 1998, which entitles me to statutory interest at ${getRate()}% per annum (8% above the Bank of England base rate) together with a fixed sum for the cost of recovering the debt. Interest continues to accrue at approximately ${fmt(figures.perDay)} per day until payment is received.`,
        "",
      )
    }
    L.push("WHAT I REQUIRE", "")
    L.push(
      `Payment of ${fmt(figures.total)} in full within ${days} days of the date of this letter, that is by ${formatDate(deadline.toISOString())}.`,
      "",
    )
    L.push("Payment should be made to:", "")
    L.push(`  Account name:    ${v(profile?.account_name, "[Account name]")}`)
    L.push(`  Sort code:       ${v(profile?.sort_code, "[Sort code]")}`)
    L.push(`  Account number:  ${v(profile?.account_number, "[Account number]")}`)
    L.push(`  Reference:       ${inv.ref}`, "")
    L.push(
      "If you dispute this debt, or you are unable to pay in full, please write to me within the same period setting out your position and enclosing any documents you rely on. If you would like to propose a payment arrangement, I will consider any reasonable proposal.",
      "",
    )
    L.push("IF I DO NOT HEAR FROM YOU", "")
    L.push(
      `If payment or a substantive response is not received by ${formatDate(deadline.toISOString())}, I may issue county court proceedings to recover the sum claimed without further notice to you. Any such claim would include the debt, continuing interest, the court issue fee and any costs allowed by the court. A judgment entered against you may affect your credit rating.`,
      "",
    )
    if (soleTrader) {
      L.push(
        "This letter is sent in accordance with the Pre-Action Protocol for Debt Claims. An information sheet, reply form and financial statement are enclosed, as the Protocol requires. Please use the reply form to respond.",
        "",
      )
    } else {
      L.push(
        "This letter is sent in accordance with the pre-action conduct requirements of the Civil Procedure Rules, and a copy will be provided to the court in the event that proceedings become necessary.",
        "",
      )
    }
    L.push(
      "I would much rather resolve this without involving the court, and a payment or a reply will end the matter here.",
      "",
    )
    L.push("Yours faithfully,", "")
    L.push(v(profile?.full_name, "[Your name]"))
    if (profile?.business_name) L.push(profile.business_name)
    return L.join("\n")
  }, [inv, profile, figures, days, deadline, soleTrader, dl])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      trackEvent("lba_copied", { invoice_id: inv.id })
    } catch {
      toast("Couldn't copy — your browser blocked clipboard access.", "error")
    }
  }

  const markSent = async () => {
    setSaving(true)
    const dueBy = addDays(new Date(), days).toISOString().split("T")[0]
    const { error } = await supabase.from("invoices").update({
      lba_sent_at: todayStr(),
      lba_deadline: dueBy,
      client_entity: soleTrader ? "sole_trader" : "company",
    }).eq("id", inv.id)
    setSaving(false)
    if (error) { toast("Couldn't save: " + error.message, "error"); return }
    trackEvent("lba_marked_sent", { invoice_id: inv.id, response_days: days })
    toast(`Recorded. ${inv.client_name || "Your client"} has until ${formatDate(dueBy)} to respond.`, "success")
    onUpdate?.()
    navigate(`/invoice/${inv.id}`)
  }

  const missing = []
  if (!profile?.account_name || !profile?.sort_code || !profile?.account_number) missing.push("your bank details")
  if (!profile?.address) missing.push("your address")
  if (!inv.client_address) missing.push("your client's address")

  return (
    <div>
      <button onClick={() => navigate(`/invoice/${inv.id}`)} className={s.back}>
        <ArrowLeft size={14} /> Back to {inv.ref}
      </button>

      <h1 className={s.title}>Letter Before Action</h1>
      <p className={s.sub}>
        The formal step before a court claim. It gives {inv.client_name || "your client"} {days} days
        to pay or respond, and it commits you to nothing.
      </p>

      <Card className={s.explainer}>
        <div className={s.explainerGrid}>
          <div>
            <div className={s.explainerHead}>What this does</div>
            <p className={s.explainerBody}>
              Sets out exactly what's owed, gives a deadline, and says what happens if it passes.
              Most debts are paid at this stage, because it's the first letter that looks like the
              start of a legal process rather than a reminder.
            </p>
          </div>
          <div>
            <div className={s.explainerHead}>What it doesn't do</div>
            <p className={s.explainerBody}>
              It doesn't start a claim and it doesn't oblige you to. You can send it and go no
              further. But if you ever do want to claim, the court expects you to have sent one
              first, so there's no downside to sending it now.
            </p>
          </div>
        </div>
      </Card>

      <Card className={s.optCard}>
        <label className={s.optRow}>
          <input
            type="checkbox"
            checked={soleTrader}
            onChange={(e) => setSoleTrader(e.target.checked)}
          />
          <span>
            <strong>{inv.client_name || "This client"} is a sole trader or an individual</strong>
            <span className={s.optHint}>
              Claims against individuals follow the Pre-Action Protocol for Debt Claims, which
              requires 30 days to respond rather than 14, and an information sheet and reply form
              sent with the letter. Tick this if you're not dealing with a limited company.
            </span>
          </span>
        </label>
      </Card>

      {missing.length > 0 && (
        <div className={s.warn}>
          Fill in {missing.join(", ")} before sending — the letter has placeholders where they should be.
          {(!profile?.account_name || !profile?.address) && (
            <> <a href="/settings" className={s.warnLink}>Go to settings</a></>
          )}
        </div>
      )}

      <div className={s.actions}>
        <Btn onClick={copy} v={copied ? "success" : "secondary"}>
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy letter</>}
        </Btn>
        <Btn onClick={() => window.print()} v="secondary"><Printer size={14} /> Print or save as PDF</Btn>
        <Btn onClick={markSent} dis={saving} v="primary">
          <Send size={14} /> {saving ? "Saving…" : "I've sent it — start the clock"}
        </Btn>
      </div>

      <pre className={s.letter}>{letter}</pre>

      <p className={s.disclaimer}>
        Hielda drafts this from your invoice and UK late payment law. It's general information
        about the process, not legal advice. If the debt is large or complicated, a solicitor is
        worth the money.
      </p>
    </div>
  )
}
