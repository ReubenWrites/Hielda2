import { useState, useMemo, useEffect, useRef } from "react"
import { Check, Copy } from "lucide-react"
import { getRate } from "../constants"
import { penalty, calcInterest, fmt, formatDate, daysLate, round2 } from "../utils"
import { trackEvent } from "../posthog"
import { ShieldLogo } from "./ui"
import s from "./LandingPage.module.css"

// Placeholder span for unfilled fields — grey so the user can see at a
// glance what still needs filling in.
const Ph = ({ children }) => <span style={{ color: "#94a3b8" }}>{children}</span>

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
  fontSize: 14, fontFamily: "inherit", color: "#0f172a", background: "#fff",
  boxSizing: "border-box",
}
const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4,
}

export default function LetterTemplate({ onBack, onGetStarted }) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState("")
  const [copied, setCopied] = useState(false)

  // Generator form state
  const [yourName, setYourName] = useState("")
  const [business, setBusiness] = useState("")
  const [clientName, setClientName] = useState("")
  const [ref, setRef] = useState("")
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState("")

  // Fire letter_generated once per visit, the first time the form has
  // enough data to produce a real letter.
  const generatedTracked = useRef(false)

  const calc = useMemo(() => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0 || !dueDate) return null
    const days = daysLate(dueDate)
    const fixed = penalty(amt)
    const interest = days > 0 ? calcInterest(amt, days) : 0
    const total = round2(amt + fixed + interest)
    return { amt, days, fixed, interest, total }
  }, [amount, dueDate])

  useEffect(() => {
    if (calc && clientName && !generatedTracked.current) {
      generatedTracked.current = true
      trackEvent("letter_generated", { days_overdue: calc.days, amount: calc.amt })
    }
  }, [calc, clientName])

  const todayFmt = formatDate(new Date().toISOString())

  // Plain-text version of the letter for the clipboard — mirrors the
  // rendered preview exactly so what users paste is what they saw.
  const letterText = () => {
    const v = (val, ph) => val || ph
    const lines = [
      v(business, "[Your Business Name]"),
      "[Your Address]",
      todayFmt,
      "",
      `Dear ${v(clientName, "[Client Name]")},`,
      "",
      `RE: Overdue Invoice ${v(ref, "[Invoice Ref]")} — Formal Notice`,
      "",
      `I am writing to notify you that invoice ${v(ref, "[Invoice Ref]")} for the sum of ${calc ? fmt(calc.amt) : "[£Amount]"} is now overdue. Payment was due on ${dueDate ? formatDate(dueDate) : "[Due Date]"}.`,
      "",
      `Under the Late Payment of Commercial Debts (Interest) Act 1998, I am legally entitled to charge statutory interest at ${getRate()}% per annum (8% above the Bank of England base rate) on the outstanding amount, accruing daily from the day after the due date, plus a fixed sum for debt recovery costs.`,
      "",
      ...(calc ? [
        "The amount now owed is:",
        "",
        `  Original invoice:            ${fmt(calc.amt)}`,
        `  Fixed debt recovery cost:    ${fmt(calc.fixed)}`,
        `  Statutory interest to date:  ${fmt(calc.interest)}${calc.days > 0 ? ` (${calc.days} days at ${getRate()}% p.a.)` : ""}`,
        `  TOTAL:                       ${fmt(calc.total)}`,
        "",
        "Interest continues to accrue daily until payment is received.",
        "",
      ] : []),
      `I would be grateful if you could arrange payment of the full amount within 7 days of the date of this letter. Payment should be made to:`,
      "",
      "  Account Name:    [Your Account Name]",
      "  Sort Code:       [XX-XX-XX]",
      "  Account Number:  [XXXXXXXX]",
      `  Reference:       ${v(ref, "[Invoice Ref]")}`,
      "",
      "If payment is not received within this period, I reserve the right to pursue this debt through formal channels, which may include referral to a debt recovery agency or County Court proceedings. Such proceedings may adversely affect your credit rating.",
      "",
      "I trust this matter can be resolved promptly. If you have already made payment, please disregard this notice and accept my thanks.",
      "",
      "Yours faithfully,",
      v(yourName, "[Your Name]"),
      v(business, "[Your Business Name]"),
    ]
    return lines.join("\n")
  }

  const copyLetter = async () => {
    try {
      await navigator.clipboard.writeText(letterText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      trackEvent("letter_copied", { filled: !!calc })
    } catch {
      setErr("Couldn't copy — your browser may not allow clipboard access.")
    }
  }

  const handleDownload = async (e) => {
    e.preventDefault()
    if (!email || !email.includes("@") || !email.includes(".")) {
      setErr("Please enter a valid email address.")
      return
    }
    setSending(true)
    setErr("")
    try {
      await fetch("/api/calculator-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          amount: calc?.amt || 0,
          days_overdue: calc?.days || 0,
          total_claimable: calc?.total || 0,
          source: "letter_template",
        }),
      })
      setSent(true)
      trackEvent("letter_template_lead_captured", { has_letter: !!calc })
    } catch {
      setErr("Something went wrong. Please try again.")
    }
    setSending(false)
  }

  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <div className={s.navLogo} onClick={onBack} style={{ cursor: "pointer" }}>
          <ShieldLogo size={28} />
          <span className={s.navLogoText}>Hielda</span>
        </div>
        <div className={s.navActions}>
          <button onClick={onGetStarted} className={s.navTrialBtn}>
            Start Free Trial
          </button>
        </div>
      </nav>

      <section className={s.hero} style={{ paddingBottom: 24 }}>
        <div className={s.heroBadge}>
          Free Tool
        </div>
        <h1 className={s.heroTitle}>
          Late Payment<br />
          <span className={s.heroAccent}>Letter Generator</span>
        </h1>
        <p className={s.heroSubtitle} style={{ maxWidth: 640 }}>
          Fill in your invoice details and get a professional, legally-grounded demand letter — with the statutory interest and fixed recovery cost calculated for you under the Late Payment of Commercial Debts Act 1998.
        </p>
      </section>

      <section style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 40px" }}>
        {/* Generator form */}
        <div style={{
          background: "#fff", borderRadius: 12, border: "1px solid #dce1e8",
          padding: "24px 28px", marginBottom: 16,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 14 }}>
            Your invoice details
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={labelStyle}>Client name</label>
              <input style={inputStyle} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Agency Ltd" />
            </div>
            <div>
              <label style={labelStyle}>Invoice reference</label>
              <input style={inputStyle} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="INV-0042" />
            </div>
            <div>
              <label style={labelStyle}>Invoice amount (£)</label>
              <input style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2500" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Due date</label>
              <input style={inputStyle} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Your name</label>
              <input style={inputStyle} value={yourName} onChange={(e) => setYourName(e.target.value)} placeholder="Sam Taylor" />
            </div>
            <div>
              <label style={labelStyle}>Your business name</label>
              <input style={inputStyle} value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Taylor Design Studio" />
            </div>
          </div>

          {calc && (
            <div style={{
              marginTop: 16, background: "#f0f7ff", border: "1px solid #c4daf4",
              borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#0f172a",
            }}>
              {calc.days > 0 ? (
                <>
                  <strong>{calc.days} day{calc.days !== 1 ? "s" : ""} overdue.</strong>{" "}
                  You can claim {fmt(calc.fixed)} fixed recovery cost + {fmt(calc.interest)} interest —{" "}
                  <strong>total owed: {fmt(calc.total)}</strong> (and counting).
                </>
              ) : (
                <>Not overdue yet — the fixed recovery cost of {fmt(calc.fixed)} and daily interest become claimable the day after the due date.</>
              )}
            </div>
          )}
        </div>

        {/* Letter preview */}
        <div style={{
          background: "#fff", borderRadius: 12, border: "1px solid #dce1e8",
          padding: "32px 28px", fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 14, lineHeight: 1.8, color: "#0f172a",
        }}>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 20 }}>
            {business ? <span style={{ color: "#0f172a" }}>{business}</span> : "[Your Business Name]"}<br />
            [Your Address]<br />
            {todayFmt}
          </p>

          <p>Dear {clientName ? clientName : <Ph>[Client Name]</Ph>},</p>

          <p><strong>RE: Overdue Invoice {ref ? ref : <Ph>[Invoice Ref]</Ph>} — Formal Notice</strong></p>

          <p>
            I am writing to notify you that invoice {ref ? ref : <Ph>[Invoice Ref]</Ph>} for
            the sum of {calc ? <strong>{fmt(calc.amt)}</strong> : <Ph>[£Amount]</Ph>} is
            now overdue. Payment was due on {dueDate ? <strong>{formatDate(dueDate)}</strong> : <Ph>[Due Date]</Ph>}.
          </p>

          <p>
            Under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>, I am legally entitled to
            charge statutory interest at <strong>{getRate()}% per annum</strong> (8% above the Bank of England base rate)
            on the outstanding amount, accruing daily from the day after the due date, plus a fixed sum for debt
            recovery costs.
          </p>

          <div style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "12px 16px", margin: "16px 0", fontSize: 13,
          }}>
            {calc ? (
              <>
                <div><strong>Original invoice:</strong> {fmt(calc.amt)}</div>
                <div style={{ marginTop: 4 }}><strong>Fixed debt recovery cost:</strong> {fmt(calc.fixed)}</div>
                <div style={{ marginTop: 4 }}><strong>Statutory interest to date:</strong> {fmt(calc.interest)}{calc.days > 0 ? ` (${calc.days} days at ${getRate()}% p.a.)` : ""}</div>
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #e2e8f0" }}><strong>Total now owed: {fmt(calc.total)}</strong> — interest continues to accrue daily</div>
              </>
            ) : (
              <>
                <div><strong>Fixed debt recovery cost:</strong> £40 (invoices up to £999.99) / £70 (£1,000–£9,999.99) / £100 (£10,000+)</div>
                <div style={{ marginTop: 4 }}><strong>Interest rate:</strong> {getRate()}% p.a. — accruing daily</div>
              </>
            )}
          </div>

          <p>
            I would be grateful if you could arrange payment of the full amount
            of {calc ? <strong>{fmt(calc.total)}</strong> : <Ph>[£Total Including Interest]</Ph>} within <strong>7 days</strong> of
            the date of this letter. Payment should be made to:
          </p>

          <div style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "12px 16px", margin: "16px 0", fontSize: 13,
          }}>
            <div><strong>Account Name:</strong> <Ph>[Your Account Name]</Ph></div>
            <div><strong>Sort Code:</strong> <Ph>[XX-XX-XX]</Ph></div>
            <div><strong>Account Number:</strong> <Ph>[XXXXXXXX]</Ph></div>
            <div><strong>Reference:</strong> {ref ? ref : <Ph>[Invoice Ref]</Ph>}</div>
          </div>

          <p>
            If payment is not received within this period, I reserve the right to pursue this debt through
            formal channels, which may include referral to a debt recovery agency or County Court proceedings.
            Such proceedings may adversely affect your credit rating.
          </p>

          <p>
            I trust this matter can be resolved promptly. If you have already made payment, please disregard
            this notice and accept my thanks.
          </p>

          <p>Yours faithfully,</p>
          <p style={{ color: yourName ? "#0f172a" : "#94a3b8" }}>
            {yourName || "[Your Name]"}<br />
            {business ? <span style={{ color: "#0f172a" }}>{business}</span> : "[Your Business Name]"}
          </p>
        </div>

        {/* Copy action */}
        <button onClick={copyLetter} style={{
          width: "100%", marginTop: 12, padding: "14px",
          background: copied ? "#15924a" : "#1e5fa0", color: "#fff",
          border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15,
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8, fontFamily: "inherit",
          transition: "background-color 0.2s",
        }}>
          {copied ? <><Check size={16} strokeWidth={2.5} /> Copied — paste it into an email or Word</> : <><Copy size={15} /> Copy letter to clipboard</>}
        </button>

        {/* Email capture */}
        <div style={{
          background: "#f0f7ff", borderRadius: 12, border: "1px solid #c4daf4",
          padding: "24px 28px", marginTop: 24, textAlign: "center",
        }}>
          {sent ? (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: "#16a34a" }}><Check size={24} strokeWidth={2.5} /></div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#16a34a", marginBottom: 8 }}>
                Check your inbox!
              </div>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
                We've sent you the template. You can also copy the letter above directly.
              </p>
              <button onClick={onGetStarted} style={{
                padding: "12px 28px", background: "#1e5fa0", color: "#fff",
                border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>
                Or let Hielda automate it — Start Free Trial
              </button>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>
                Get this template emailed to you
              </div>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
                Plus tips on enforcing late payment under UK law. No spam, ever.
              </p>
              <form onSubmit={handleDownload} style={{ display: "flex", gap: 8, maxWidth: 400, margin: "0 auto" }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@business.com"
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1",
                    fontSize: 14, fontFamily: "inherit",
                  }}
                />
                <button type="submit" disabled={sending} style={{
                  padding: "10px 20px", background: "#1e5fa0", color: "#fff",
                  border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14,
                  cursor: sending ? "wait" : "pointer", opacity: sending ? 0.7 : 1,
                }}>
                  {sending ? "Sending..." : "Send"}
                </button>
              </form>
              {err && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{err}</p>}
            </>
          )}
        </div>

        {/* Related guides — surface deeper content for SEO + user value */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Related reading
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <a href="/guides/letter-before-action" style={{ background: "#fff", border: "1px solid #dce1e8", borderRadius: 10, padding: "14px 16px", textDecoration: "none", color: "#0f172a", display: "block" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Letter Before Action — how and when to send one</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>The formal pre-court step, what it must contain, and why it's usually the letter that gets you paid.</div>
            </a>
            <a href="/guides/late-payment-act-1998-explained" style={{ background: "#fff", border: "1px solid #dce1e8", borderRadius: 10, padding: "14px 16px", textDecoration: "none", color: "#0f172a", display: "block" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>The Late Payment Act 1998 — explained</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>Who it covers, what you're entitled to, common myths, and how to actually use it.</div>
            </a>
            <a href="/guides/how-to-chase-late-invoices" style={{ background: "#fff", border: "1px solid #dce1e8", borderRadius: 10, padding: "14px 16px", textDecoration: "none", color: "#0f172a", display: "block" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>How to chase late invoices — playbook</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>Day-by-day timeline. When to send what; when to escalate.</div>
            </a>
            <a href="/calculator" style={{ background: "#fff", border: "1px solid #dce1e8", borderRadius: 10, padding: "14px 16px", textDecoration: "none", color: "#0f172a", display: "block" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Late payment interest calculator</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>Work out exactly what you're owed in statutory interest plus fixed sum.</div>
            </a>
          </div>
        </div>

        {/* Why automate CTA */}
        <div style={{
          background: "#0f172a", borderRadius: 12, padding: "28px", marginTop: 24,
          textAlign: "center", color: "#fff",
        }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
            Why write letters when Hielda does it for you?
          </div>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 20px", lineHeight: 1.7 }}>
            Hielda sends 19 escalating chase emails automatically, calculates statutory interest daily,
            and checks in with you before every step. You never have to write another letter.
          </p>
          <button onClick={onGetStarted} style={{
            padding: "12px 28px", background: "#1e5fa0", color: "#fff",
            border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>
            Start Your Free 6-Week Trial
          </button>
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
            No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      <footer className={s.footer}>
        <span>© {new Date().getFullYear()} Hielda. Protecting your pay.</span>
      </footer>
    </main>
  )
}
