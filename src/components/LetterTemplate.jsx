import { useState } from "react"
import { getRate } from "../constants"
import { ShieldLogo } from "./ui"
import s from "./LandingPage.module.css"

export default function LetterTemplate({ onBack, onGetStarted }) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState("")

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
          amount: 0,
          days_overdue: 0,
          total_claimable: 0,
          source: "letter_template",
        }),
      })
      setSent(true)
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
          Free Template
        </div>
        <h1 className={s.heroTitle}>
          Free Late Payment<br />
          <span className={s.heroAccent}>Letter Template</span>
        </h1>
        <p className={s.heroSubtitle} style={{ maxWidth: 640 }}>
          A professional, legally-grounded letter you can send to any UK client who hasn't paid on time. References the Late Payment of Commercial Debts Act 1998 and puts the debtor on formal notice.
        </p>
      </section>

      {/* Letter preview */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 40px" }}>
        <div style={{
          background: "#fff", borderRadius: 12, border: "1px solid #dce1e8",
          padding: "32px 28px", fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 14, lineHeight: 1.8, color: "#0f172a",
        }}>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 20 }}>[Your Business Name]<br />[Your Address]<br />[Date]</p>

          <p>Dear <span style={{ color: "#94a3b8" }}>[Client Name]</span>,</p>

          <p><strong>RE: Overdue Invoice <span style={{ color: "#94a3b8" }}>[Invoice Ref]</span> — Formal Notice</strong></p>

          <p>
            I am writing to notify you that invoice <span style={{ color: "#94a3b8" }}>[Invoice Ref]</span> for
            the sum of <span style={{ color: "#94a3b8" }}>[£Amount]</span>, dated <span style={{ color: "#94a3b8" }}>[Invoice Date]</span>,
            is now overdue. Payment was due on <span style={{ color: "#94a3b8" }}>[Due Date]</span>.
          </p>

          <p>
            Under the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong>, I am legally entitled to
            charge statutory interest at <strong>{getRate()}% per annum</strong> (8% above the Bank of England base rate)
            on the outstanding amount, accruing daily from the day after the due date. I am also entitled to a fixed
            penalty for debt recovery costs:
          </p>

          <div style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "12px 16px", margin: "16px 0", fontSize: 13,
          }}>
            <div><strong>Fixed penalty:</strong> £40 (invoices up to £999.99) / £70 (£1,000–£9,999.99) / £100 (£10,000+)</div>
            <div style={{ marginTop: 4 }}><strong>Interest rate:</strong> {getRate()}% p.a. — accruing daily</div>
          </div>

          <p>
            I would be grateful if you could arrange payment of the full amount
            of <span style={{ color: "#94a3b8" }}>[£Total Including Interest]</span> within <strong>7 days</strong> of
            the date of this letter. Payment should be made to:
          </p>

          <div style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "12px 16px", margin: "16px 0", fontSize: 13,
          }}>
            <div><strong>Account Name:</strong> <span style={{ color: "#94a3b8" }}>[Your Account Name]</span></div>
            <div><strong>Sort Code:</strong> <span style={{ color: "#94a3b8" }}>[XX-XX-XX]</span></div>
            <div><strong>Account Number:</strong> <span style={{ color: "#94a3b8" }}>[XXXXXXXX]</span></div>
            <div><strong>Reference:</strong> <span style={{ color: "#94a3b8" }}>[Invoice Ref]</span></div>
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
          <p style={{ color: "#94a3b8" }}>[Your Name]<br />[Your Business Name]</p>
        </div>

        {/* Email capture */}
        <div style={{
          background: "#f0f7ff", borderRadius: 12, border: "1px solid #c4daf4",
          padding: "24px 28px", marginTop: 24, textAlign: "center",
        }}>
          {sent ? (
            <>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
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
