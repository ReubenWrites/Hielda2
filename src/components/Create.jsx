import { useState } from "react"
import { supabase } from "../supabase"
import { colors as c, FONT, MONO, TERMS, RATE } from "../constants"
import { penalty, fmt, formatDate, addDays, generateRef, todayStr, isValidEmail } from "../utils"
import { Card, Inp, Sel, Btn, ErrorBanner } from "./ui"

export default function Create({ profile, nav, userId, onCreated, isMobile }) {
  const defaultTerms = profile?.default_payment_terms ? String(profile.default_payment_terms) : "30"
  const isCustomDefault = !TERMS.slice(0, -1).some(t => String(t.d) === defaultTerms)

  const [cn, setCn] = useState("")
  const [ce, setCe] = useState("")
  const [ca, setCa] = useState("")
  const [desc, setDesc] = useState("")
  const [amt, setAmt] = useState("")
  const [terms, setTerms] = useState(isCustomDefault ? "-1" : defaultTerms)
  const [customDays, setCustomDays] = useState(isCustomDefault ? defaultTerms : "")
  const [date, setDate] = useState(todayStr())
  const [step, setStep] = useState(1)
  const [meth, setMeth] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [ref, setRef] = useState(generateRef)
  const [noFines, setNoFines] = useState(false)
  const [sendIntro, setSendIntro] = useState(false)
  const [introMethod, setIntroMethod] = useState(null)
  const [introText, setIntroText] = useState("")
  const [introCopied, setIntroCopied] = useState(false)
  const [showIntroInfo, setShowIntroInfo] = useState(false)

  const effectiveDays = terms === "-1" ? (parseInt(customDays) || 0) : parseInt(terms)
  const due = addDays(date, effectiveDays)
  const p = penalty(parseFloat(amt) || 0)
  const parsedAmt = parseFloat(amt)

  // Validation
  const emailError = ce && !isValidEmail(ce) ? "Invalid email format" : ""
  const amtError = amt && (isNaN(parsedAmt) || parsedAmt <= 0) ? "Amount must be greater than 0" : ""
  const customDaysError = terms === "-1" && (!customDays || parseInt(customDays) < 1 || parseInt(customDays) > 365) ? "Enter 1–365 days" : ""
  const canProceed = cn && ce && !emailError && amt && !amtError && desc && !customDaysError && effectiveDays > 0

  const buildIntroText = () => {
    const sender = profile?.business_name || profile?.full_name || "your contact"
    const client = cn || "there"
    return `Hi ${client},\n\nJust a quick note to let you know that ${sender} has recently started using Hielda to manage their invoicing and payments professionally. This has nothing to do with you specifically — it's simply good practice for independent professionals to have a dedicated system handling the admin side of things, because cashflow is critically important to individuals and small businesses.\n\nFrom now on, invoice-related communications may come via Hielda. Nothing changes on your side — you'll continue to receive invoices and payment reminders as normal. If you have any questions, please feel free to get in touch directly with ${sender}.\n\nWarm regards,\nThe Hielda team, on behalf of ${sender}`
  }

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
    setSendIntro(false)
    setIntroMethod(null)
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
      const { error: dbError } = await supabase.from("invoices").insert({
        user_id: userId,
        ref,
        description: desc,
        amount: parsedAmt,
        issue_date: date,
        payment_term_days: effectiveDays,
        due_date: dueStr,
        status: isOverdue ? "overdue" : "pending",
        chase_stage: isOverdue ? "reminder_1" : null,
        send_method: meth,
        no_fines: noFines,
        client_name: cn,
        client_email: ce,
        client_address: ca,
      })
      if (dbError) throw dbError
      onCreated()

      // Send client intro email if requested
      if (sendIntro && introMethod === "hielda") {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch("/api/send-intro-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: cn,
            client_email: ce,
            intro_text: introText,
            user_token: session?.access_token,
          }),
        })
      }

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

        {sendIntro && introMethod === "hielda" && (
          <div style={{ fontSize: 12, color: c.gn, marginBottom: 16, padding: "8px 16px", background: c.gnd, borderRadius: 8 }}>
            ✓ Introduction email sent to {cn}
          </div>
        )}

        {sendIntro && introMethod === "self" && (
          <div style={{ width: "100%", maxWidth: 480, marginBottom: 20, textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Copy and send this to {cn}
            </div>
            <textarea
              readOnly
              value={introText}
              style={{
                width: "100%", minHeight: 160, fontSize: 12, color: c.tx, fontFamily: FONT,
                padding: 12, borderRadius: 8, border: `1px solid ${c.bd}`, background: c.bg,
                resize: "none", boxSizing: "border-box", lineHeight: 1.6,
              }}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(introText); setIntroCopied(true) }}
              style={{
                marginTop: 8, width: "100%", padding: "8px", borderRadius: 8, fontSize: 12,
                fontWeight: 600, cursor: "pointer", fontFamily: FONT, border: `1.5px solid ${c.ac}`,
                background: introCopied ? c.acd : "#fff", color: c.ac,
              }}
            >
              {introCopied ? "✓ Copied!" : "Copy to clipboard"}
            </button>
          </div>
        )}

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
            <Sel label="Payment Terms" value={terms} onChange={(v) => { setTerms(v); if (v !== "-1") setCustomDays(""); }} opts={TERMS.map((t) => ({ l: t.l, v: String(t.d) }))} />
            {terms === "-1" && (
              <Inp label="Custom Days" value={customDays} onChange={setCustomDays} ph="e.g. 21" type="number" mono error={customDaysError} />
            )}
            <Inp label="Issue Date" value={date} onChange={setDate} type="date" />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 4 }}>
              <input type="checkbox" id="noFines" checked={noFines} onChange={(e) => setNoFines(e.target.checked)} style={{ accentColor: c.ac, width: 16, height: 16 }} />
              <label htmlFor="noFines" style={{ fontSize: 12, color: c.tm, cursor: "pointer" }}>
                Chase without fines or interest
              </label>
            </div>
            {noFines && (
              <div style={{ fontSize: 11, color: c.td, marginBottom: 4, paddingLeft: 24 }}>
                We'll still send chase emails, but won't add statutory penalties or interest.
              </div>
            )}
            <div style={{ marginTop: 10, padding: 10, background: c.bg, borderRadius: 8, border: `1px solid ${c.bd}`, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: c.tm }}>Ref</span>
                <span style={{ fontFamily: MONO, color: c.ac }}>{ref}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={{ color: c.tm }}>Due</span>
                <span style={{ color: c.tx, fontWeight: 500 }}>{formatDate(due)}</span>
              </div>
              {amt && !amtError && !noFines && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, color: c.td, fontSize: 11 }}>
                  <span>Late penalty</span>
                  <span>{fmt(p)} + {RATE}% p.a.</span>
                </div>
              )}
              {amt && !amtError && noFines && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, color: c.td, fontSize: 11 }}>
                  <span>Late penalty</span>
                  <span style={{ fontStyle: "italic" }}>Waived</span>
                </div>
              )}
            </div>
          </Card>
          {/* Existing client intro */}
          <div style={{ gridColumn: "1/-1" }}>
            <Card>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input
                  type="checkbox"
                  id="sendIntro"
                  checked={sendIntro}
                  onChange={(e) => {
                    setSendIntro(e.target.checked)
                    if (e.target.checked && !introText) setIntroText(buildIntroText())
                  }}
                  style={{ accentColor: c.ac, width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label htmlFor="sendIntro" style={{ fontSize: 13, fontWeight: 600, color: c.tx, cursor: "pointer" }}>
                      Send {cn || "this client"} a friendly introduction to Hielda
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowIntroInfo(v => !v)}
                      style={{
                        width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${c.bd}`,
                        background: showIntroInfo ? c.acd : c.sf, color: showIntroInfo ? c.ac : c.td,
                        fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0,
                      }}
                      aria-label="About this feature"
                    >
                      ?
                    </button>
                  </div>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: c.tm, marginTop: 2 }}>
                    For existing clients you now want to manage through Hielda.
                  </span>
                  {showIntroInfo && (
                    <div style={{
                      marginTop: 8, padding: "10px 12px", background: c.acd, borderRadius: 8,
                      border: `1px solid ${c.ac}30`, fontSize: 12, color: c.tx, lineHeight: 1.6,
                    }}>
                      <strong style={{ color: c.ac }}>What this does:</strong> Sends a professional, friendly email to your client explaining that you've started using Hielda to manage your invoicing. It reassures them that nothing changes on their end — they'll still receive invoices and reminders as normal. This is especially useful for long-standing clients who might be surprised to receive emails from Hielda.
                    </div>
                  )}
                </div>
              </div>

              {sendIntro && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                    Email text — edit freely
                  </div>
                  <textarea
                    value={introText}
                    onChange={(e) => setIntroText(e.target.value)}
                    style={{
                      width: "100%", minHeight: 180, fontSize: 12, color: c.tx, fontFamily: FONT,
                      padding: 12, borderRadius: 8, border: `1px solid ${c.bd}`, background: c.bg,
                      resize: "vertical", boxSizing: "border-box", lineHeight: 1.6,
                    }}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setIntroMethod("hielda")}
                      style={{
                        padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: FONT, border: `1.5px solid ${introMethod === "hielda" ? c.ac : c.bd}`,
                        background: introMethod === "hielda" ? c.acd : "#fff", color: introMethod === "hielda" ? c.ac : c.tm,
                      }}
                    >
                      📧 Hielda sends it for me
                    </button>
                    <button
                      onClick={() => setIntroMethod("self")}
                      style={{
                        padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: FONT, border: `1.5px solid ${introMethod === "self" ? c.ac : c.bd}`,
                        background: introMethod === "self" ? c.acd : "#fff", color: introMethod === "self" ? c.ac : c.tm,
                      }}
                    >
                      ✍️ I'll send it myself
                    </button>
                  </div>
                  {introMethod === "self" && (
                    <div style={{ marginTop: 10, fontSize: 11, color: c.tm, padding: "8px 12px", background: c.bg, borderRadius: 8, border: `1px solid ${c.bd}` }}>
                      We'll show you this text to copy after the invoice is created.
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

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
                  <div>Terms: {effectiveDays} days</div>
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
