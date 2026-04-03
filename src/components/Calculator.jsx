import { useState, useCallback, useEffect } from "react"
import { getRate, getBoe } from "../constants"
import { calcInterest, penalty, fmt } from "../utils"
import { Card, ShieldLogo } from "./ui"
import { trackEvent } from "../posthog"
import s from "./Calculator.module.css"

const CALC_FAQS = [
  {
    q: "What is the Late Payment of Commercial Debts Act 1998?",
    a: "It's a UK law that gives businesses the right to charge statutory interest and fixed penalties on overdue B2B invoices. The interest rate is 8% above the Bank of England base rate. The Act applies automatically to all qualifying B2B transactions — you don't need to include it in your contract or state it on your invoice.",
  },
  {
    q: "How is statutory interest on late invoices calculated?",
    a: "Interest accrues daily at the statutory rate (currently the Bank of England base rate plus 8% per annum). The formula is: invoice amount × annual rate ÷ 365 × number of days overdue. Interest continues to accrue until the invoice is paid in full.",
  },
  {
    q: "What fixed penalty can I claim on a late invoice?",
    a: "The Act entitles you to a fixed debt recovery cost per invoice: £40 for invoices under £1,000, £70 for invoices between £1,000 and £9,999, and £100 for invoices of £10,000 or more. This is charged in addition to any interest and applies per invoice.",
  },
  {
    q: "Does the Late Payment Act apply to all invoices?",
    a: "The Act applies to business-to-business (B2B) transactions only — both parties must be acting in the course of a business. It does not cover invoices to consumers. It applies throughout the UK and covers freelance and contractor invoices as well as those from limited companies.",
  },
  {
    q: "Do I need to mention interest charges on my original invoice?",
    a: "No. Your right to charge statutory interest and penalties exists automatically under the Act — even if you didn't mention it on your invoice or in your contract. You can apply these charges retrospectively to any qualifying overdue B2B invoice.",
  },
]

export default function Calculator({ onBack, onGetStarted, isMobile }) {
  const [amount, setAmount] = useState("")
  const [daysOverdue, setDaysOverdue] = useState("")
  useEffect(() => {
    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.id = "faq-schema-calculator"
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": CALC_FAQS.map(({ q, a }) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a },
      })),
    })
    document.head.appendChild(script)
    return () => document.getElementById("faq-schema-calculator")?.remove()
  }, [])

  const [openFaq, setOpenFaq] = useState(null)
  const [leadEmail, setLeadEmail] = useState("")
  const [leadSent, setLeadSent] = useState(false)
  const [leadSending, setLeadSending] = useState(false)

  const parsedAmt = parseFloat(amount) || 0
  const parsedDays = parseInt(daysOverdue) || 0
  const hasInput = parsedAmt > 0 && parsedDays > 0

  const trackCalc = useCallback(() => {
    if (parsedAmt > 0 && parsedDays > 0) trackEvent("calculator_used", { amount: parsedAmt, days: parsedDays })
  }, [parsedAmt, parsedDays])

  const interest = hasInput ? calcInterest(parsedAmt, parsedDays) : 0
  const pen = hasInput ? penalty(parsedAmt) : 0
  const total = parsedAmt + interest + pen

  const penTier = parsedAmt >= 10000 ? "£100" : parsedAmt >= 1000 ? "£70" : "£40"

  const sendLeadEmail = async () => {
    if (!leadEmail.trim() || leadSent) return
    setLeadSending(true)
    try {
      await fetch("/api/calculator-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: leadEmail.trim(),
          invoice_amount: parsedAmt,
          days_overdue: parsedDays,
          total_claimable: total,
        }),
      })
      trackEvent("calculator_lead_captured", { amount: parsedAmt, days: parsedDays, total })
      setLeadSent(true)
    } catch {
      // Non-critical — silently fail, don't interrupt the user
      setLeadSent(true)
    }
    setLeadSending(false)
  }

  return (
    <div className={s.page}>
      {/* Nav */}
      <nav className={s.nav}>
        <div className={s.navLogo} onClick={onBack}>
          <ShieldLogo size={28} />
          <span className={s.navLogoText}>Hielda</span>
        </div>
        <button onClick={onGetStarted} className={s.navTrialBtn}>
          Start Free Trial
        </button>
      </nav>

      {/* Header */}
      <section className={s.header}>
        <button onClick={onBack} className={s.backBtn}>
          ← Back to home
        </button>
        <h1 className={s.title}>
          UK Late Payment Calculator
        </h1>
        <p className={s.subtitle}>
          Calculate the statutory interest and penalties you're legally owed on overdue B2B invoices under UK law.
        </p>
        <p className={s.legalRef}>
          Based on the Late Payment of Commercial Debts (Interest) Act 1998
        </p>
      </section>

      {/* Calculator */}
      <section className={s.calcBody}>
        <Card style={{ padding: isMobile ? "24px 20px" : "32px 28px" }}>
          {/* Inputs */}
          <div className={s.inputGrid}>
            <div>
              <label className={s.inputLabel}>
                Invoice amount
              </label>
              <div className={s.inputWrap}>
                <span className={s.currencySign}>£</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={s.amountInput}
                />
              </div>
            </div>
            <div>
              <label className={s.inputLabel}>
                Days overdue
              </label>
              <input
                type="number"
                value={daysOverdue}
                onChange={(e) => setDaysOverdue(e.target.value)}
                onBlur={trackCalc}
                placeholder="e.g. 30"
                className={s.daysInput}
              />
            </div>
          </div>

          {/* Results */}
          {hasInput && (
            <div className={s.results}>
              {[
                { label: "Original invoice", value: fmt(parsedAmt), color: "var(--tx)" },
                { label: `Fixed penalty (invoice ${penTier} tier)`, value: `+ ${fmt(pen)}`, color: "#d97706" },
                { label: `Interest (${parsedDays} days at ${getRate()}% p.a.)`, value: `+ ${fmt(interest)}`, color: "#d97706" },
              ].map((row) => (
                <div key={row.label} className={s.resultRow}>
                  <span className={s.resultRowLabel}>{row.label}</span>
                  <span className={s.resultRowVal} style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
              <div className={s.totalRow}>
                <span className={s.totalLabel}>Total owed to you</span>
                <span className={s.totalVal}>{fmt(total)}</span>
              </div>
              <p className={s.accrualNote}>
                Interest accrues daily. The longer they wait, the more you're owed.
              </p>

              {/* Lead capture */}
              {!leadSent ? (
                <div className={s.leadSection}>
                  <p className={s.leadTitle}>
                    Save this calculation
                  </p>
                  <p className={s.leadDesc}>
                    Enter your email and we'll save your result so you can refer back to it — plus tips on exactly what to say to your client.
                  </p>
                  <div className={s.leadRow}>
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendLeadEmail()}
                      placeholder="your@email.com"
                      className={s.leadInput}
                    />
                    <button
                      onClick={sendLeadEmail}
                      disabled={leadSending || !leadEmail.trim()}
                      className={s.leadBtn}
                    >
                      {leadSending ? "..." : "Send"}
                    </button>
                  </div>
                  <p className={s.leadDisclaimer}>No spam. Unsubscribe any time.</p>
                </div>
              ) : (
                <div className={s.leadSuccess}>
                  <span className={s.leadSuccessText}>✓ Saved! Check your inbox.</span>
                  <button onClick={onGetStarted} className={s.leadBtn} style={{ marginTop: 12, width: "100%" }}>
                    Start your free trial — chase this invoice now
                  </button>
                </div>
              )}
            </div>
          )}

          {!hasInput && (
            <div className={s.emptyState}>
              Enter an amount and days overdue to see your calculation.
            </div>
          )}
        </Card>

        {/* Penalty tiers info */}
        <Card style={{ marginTop: 16, padding: isMobile ? "20px" : "24px 28px" }}>
          <h3 className={s.infoTitle}>
            How it's calculated
          </h3>
          <div className={s.infoBody}>
            <p className={s.infoText}>
              The <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong> gives businesses the right to charge interest and a fixed penalty on overdue B2B invoices.
            </p>
            <div className={s.infoGrid}>
              <div className={s.infoBox}>
                <div className={s.infoBoxLabel}>Interest rate</div>
                <div className={s.infoBoxText}>
                  Bank of England base rate ({getBoe()}%) + 8% = <strong style={{ color: "var(--tx)" }}>{getRate()}% per annum</strong>
                </div>
              </div>
              <div className={s.infoBox}>
                <div className={s.infoBoxLabel}>Fixed penalties</div>
                <div className={s.infoBoxText}>
                  Under £1,000: <strong>£40</strong><br />
                  £1,000–£9,999: <strong>£70</strong><br />
                  £10,000+: <strong>£100</strong>
                </div>
              </div>
            </div>
            <p className={s.infoFootnote}>
              These are your legal rights — not optional extras. Most freelancers never claim them.
            </p>
          </div>
        </Card>

        {/* FAQ */}
        <div className={s.faqSection}>
          <h2 className={s.faqTitle}>
            Frequently asked questions
          </h2>
          <div className={s.faqList}>
            {CALC_FAQS.map(({ q, a }) => {
              const isOpen = openFaq === q
              return (
                <div key={q} className={isOpen ? s.faqItemOpen : s.faqItem}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : q)}
                    className={s.faqBtn}
                  >
                    <h3 className={s.faqQuestion}>{q}</h3>
                    <span className={s.faqToggle}>{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className={s.faqAnswer}>
                      <p className={s.faqAnswerText}>{a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        <div className={s.ctaSection}>
          <h3 className={s.ctaTitle}>
            Stop leaving money on the table
          </h3>
          <p className={s.ctaSubtitle}>
            Hielda chases late invoices and enforces penalties automatically — so you don't have to.
          </p>
          <button onClick={onGetStarted} className={s.ctaBtn}>
            Start Free Trial
          </button>
          <p className={s.ctaSmall}>
            No credit card required · 6-week free trial
          </p>
        </div>
      </section>
    </div>
  )
}
