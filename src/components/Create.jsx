import { useState } from "react"
import { supabase } from "../supabase"
import { colors as c, FONT, MONO, TERMS, RATE } from "../constants"
import { penalty, fmt, formatDate, addDays, generateRef, todayStr, isValidEmail } from "../utils"
import { Card, Inp, Sel, Btn, ErrorBanner } from "./ui"

export default function Create({ profile, nav, userId, onCreated, isMobile }) {
  const [cn, setCn] = useState("")
  const [ce, setCe] = useState("")
  const [ca, setCa] = useState("")
  const [desc, setDesc] = useState("")
  const [amt, setAmt] = useState("")
  const [terms, setTerms] = useState("30")
  const [date, setDate] = useState(todayStr())
  const [step, setStep] = useState(1)
  const [meth, setMeth] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [ref, setRef] = useState(generateRef)

  const due = addDays(date, parseInt(terms))
  const p = penalty(parseFloat(amt) || 0)
  const parsedAmt = parseFloat(amt)

  // Validation
  const emailError = ce && !isValidEmail(ce) ? "Invalid email format" : ""
  const amtError = amt && (isNaN(parsedAmt) || parsedAmt <= 0) ? "Amount must be greater than 0" : ""
  const canProceed = cn && ce && !emailError && amt && !amtError && desc

  const resetForm = () => {
    setCn("")
    setCe("")
    setCa("")
    setDesc("")
    setAmt("")
    setStep(1)
    setMeth(null)
    setError("")
    setRef(generateRef())
  }

  const go = async () => {
    setSaving(true)
    setError("")
    try {
      const dueStr = due.toISOString().split("T")[0]
      const today = todayStr()
      const isOverdue = dueStr < today
      const { error: dbError } = await supabase.from("invoices").insert({
        user_id: userId,
        ref,
        description: desc,
        amount: parsedAmt,
        issue_date: date,
        payment_term_days: parseInt(terms),
        due_date: dueStr,
        status: isOverdue ? "overdue" : "pending",
        chase_stage: isOverdue ? "reminder_1" : null,
        send_method: meth,
        client_name: cn,
        client_email: ce,
        client_address: ca,
      })
      if (dbError) throw dbError
      onCreated()
      setStep(3)
    } catch (e) {
      setError("Failed to create invoice: " + e.message)
    }
    setSaving(false)
  }

  if (step === 3) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, textAlign: "center" }}>
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: c.gnd, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 16 }}>
          ✓
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: c.tx, margin: "0 0 6px" }}>Invoice Created</h2>
        <p style={{ color: c.tm, fontSize: 13, marginBottom: 5 }}>{ref} · {fmt(parsedAmt)} · {cn}</p>
        <p style={{ color: c.tm, fontSize: 12, marginBottom: 20 }}>Hielda will chase automatically if unpaid by {formatDate(due)}.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => nav("dash")}>Dashboard</Btn>
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
      <h1 style={{ fontSize: 21, fontWeight: 700, color: c.tx, margin: "0 0 5px" }}>Create Invoice</h1>
      <p style={{ color: c.tm, margin: "0 0 22px", fontSize: 13 }}>Your details are pre-filled. Add client and job info.</p>

      <div style={{ display: "flex", gap: 4, marginBottom: 22 }}>
        {["Client & Job", "Review & Send"].map((l, i) => (
          <div key={l} style={{ flex: 1 }}>
            <div style={{ height: 3, borderRadius: 2, background: i + 1 <= step ? c.ac : c.bd, marginBottom: 6 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: i + 1 <= step ? c.ac : c.td, textTransform: "uppercase", letterSpacing: "0.04em" }}>{l}</span>
          </div>
        ))}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18 }}>
          <Card>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: "0 0 14px" }}>Client</h3>
            <Inp label="Company Name" value={cn} onChange={setCn} ph="e.g. Mega Corp Ltd" />
            <Inp label="Email" value={ce} onChange={setCe} ph="accounts@client.com" type="email" error={emailError} />
            <Inp label="Address" value={ca} onChange={setCa} ph="Full address" ta />
          </Card>
          <Card>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: "0 0 14px" }}>Job</h3>
            <Inp label="Description" value={desc} onChange={setDesc} ph="e.g. Video production" />
            <Inp label="Amount (£)" value={amt} onChange={setAmt} ph="0.00" type="number" mono error={amtError} />
            <Sel label="Payment Terms" value={terms} onChange={setTerms} opts={TERMS.map((t) => ({ l: t.l, v: String(t.d) }))} />
            <Inp label="Issue Date" value={date} onChange={setDate} type="date" />
            <div style={{ marginTop: 10, padding: 10, background: c.bg, borderRadius: 8, border: `1px solid ${c.bd}`, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: c.tm }}>Ref</span>
                <span style={{ fontFamily: MONO, color: c.ac }}>{ref}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={{ color: c.tm }}>Due</span>
                <span style={{ color: c.tx, fontWeight: 500 }}>{formatDate(due)}</span>
              </div>
              {amt && !amtError && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, color: c.td, fontSize: 11 }}>
                  <span>Late penalty</span>
                  <span>{fmt(p)} + {RATE}% p.a.</span>
                </div>
              )}
            </div>
          </Card>
          <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end" }}>
            <Btn dis={!canProceed} onClick={() => setStep(2)}>Review →</Btn>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
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
                  <div>Terms: {terms} days</div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${c.bdl}`, borderBottom: `1px solid ${c.bdl}`, padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
                  <span style={{ color: c.tx }}>{desc}</span>
                  <span style={{ fontWeight: 700, fontFamily: MONO }}>{fmt(parsedAmt || 0)}</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: c.tx }}>Total Due</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: c.ac, fontFamily: MONO }}>{fmt(parsedAmt || 0)}</span>
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
