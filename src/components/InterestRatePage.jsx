import { useEffect, useState } from "react"
import { ShieldLogo } from "./ui"
import { getBoe, getRate, loadLiveBoeRate, onRateChange } from "../constants"
import { trackEvent } from "../posthog"
import s from "./guides/guides.module.css"

// /late-payment-interest-rate
// Always-current answer to "what is the statutory late payment interest
// rate right now?", which spikes every time the Bank of England moves.
// Figures come from /api/boe-rate at runtime; the prerendered HTML carries
// the fallback rate and updates on load.

const fmt = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n)
const pct = (n) => `${Number(n).toFixed(2).replace(/\.?0+$/, "")}%`
const longDate = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d) ? null : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}
const penalty = (amt) => (amt >= 10000 ? 100 : amt >= 1000 ? 70 : 40)

export const RATE_FAQS = [
  { q: "What is the statutory interest rate for late payment in the UK?", a: "8% above the Bank of England base rate, per year, under the Late Payment of Commercial Debts (Interest) Act 1998. It applies to business-to-business invoices that are paid late and needs no clause in your contract." },
  { q: "Which base rate is used: today's or an earlier one?", a: "The Act fixes a reference rate twice a year. The base rate on 31 December applies to invoices that become overdue between 1 January and 30 June; the base rate on 30 June applies to invoices that become overdue between 1 July and 31 December. A base rate change in between does not alter the rate on an invoice already running." },
  { q: "Is the interest simple or compound?", a: "Simple interest, calculated daily on the unpaid amount from the day after the due date until the day it is paid." },
  { q: "Can I charge interest if my contract does not mention it?", a: "Yes. The right comes from the Act, not from your terms. If your contract sets its own rate it must be a substantial remedy, otherwise the statutory rate applies instead." },
  { q: "What else can I add to a late invoice?", a: "A fixed debt recovery cost per invoice of £40 (under £1,000), £70 (£1,000 to £9,999.99) or £100 (£10,000 and over), plus reasonable recovery costs above that amount." },
]

export default function InterestRatePage({ onBack, onGetStarted }) {
  const [rate, setRate] = useState({ boe: getBoe(), statutory: getRate() })
  const [meta, setMeta] = useState({ changedOn: null, referenceRate: null, referenceDate: null, live: false })
  const [openFaq, setOpenFaq] = useState(null)

  useEffect(() => {
    const off = onRateChange(({ boe, rate: statutory }) => setRate({ boe, statutory }))
    loadLiveBoeRate()
    ;(async () => {
      try {
        const r = await fetch("/api/boe-rate")
        if (!r.ok) return
        const j = await r.json()
        setMeta({ changedOn: j.changed_on, referenceRate: j.reference_rate, referenceDate: j.reference_date, live: !j.fallback })
      } catch {}
    })()
    return off
  }, [])

  const go = (fn) => (e) => { e.preventDefault(); fn() }
  const today = new Date()
  const half = today.getMonth() >= 6 ? "1 July to 31 December" : "1 January to 30 June"
  const refRate = meta.referenceRate ?? rate.boe
  const statutoryRef = 8 + refRate
  const daily = statutoryRef / 365 / 100

  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <a href="/" className={s.navLogo} onClick={go(onBack)} style={{ textDecoration: "none", color: "inherit" }}>
          <ShieldLogo size={28} />
          <span className={s.navLogoText}>Hielda</span>
        </a>
        <button onClick={() => { trackEvent("rate_page_cta_clicked", { placement: "nav" }); onGetStarted() }} className={s.navTrialBtn}>
          Start Free Trial
        </button>
      </nav>

      <article className={s.article}>
        <nav className={s.breadcrumbs} aria-label="Breadcrumb">
          <a href="/" onClick={go(onBack)}>Home</a>{" · "}<span>Late payment interest rate</span>
        </nav>

        <h1 className={s.title}>UK Late Payment Interest Rate {today.getFullYear()}</h1>
        <p className={s.lede}>
          The statutory interest rate on late commercial payments right now, how it is set, and what it adds to an overdue invoice per day.
        </p>

        <div className={s.workedExample} style={{ marginTop: 0 }}>
          <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Current statutory rate</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#0f172a", lineHeight: 1.1, margin: "6px 0" }} translate="no">{pct(statutoryRef)} <span style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>per year</span></div>
          <div style={{ fontSize: 14, color: "#334155" }}>
            8% + Bank of England base rate of <strong>{pct(refRate)}</strong>
            {meta.referenceDate ? <> (the rate in force on {longDate(meta.referenceDate)}, which the Act fixes for invoices falling overdue {half})</> : null}.
          </div>
          {meta.live && rate.boe !== refRate && (
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
              Today's base rate is {pct(rate.boe)}{meta.changedOn ? `, changed on ${longDate(meta.changedOn)}` : ""}. It takes effect for statutory interest from the next reference date.
            </div>
          )}
          {meta.live && rate.boe === refRate && meta.changedOn && (
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>Base rate unchanged since {longDate(meta.changedOn)}.</div>
          )}
        </div>

        <div className={s.body}>
          <h2>What the late payment interest rate adds to an overdue invoice</h2>
          <p>Interest is simple, runs daily from the day after the due date, and sits on top of the fixed debt recovery cost the Act also allows. At {pct(statutoryRef)} a year:</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, margin: "0 0 20px" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <th style={{ padding: "8px 6px", borderBottom: "2px solid #e2e8f0" }}>Invoice</th>
                <th style={{ padding: "8px 6px", borderBottom: "2px solid #e2e8f0" }}>Per day</th>
                <th style={{ padding: "8px 6px", borderBottom: "2px solid #e2e8f0" }}>30 days late</th>
                <th style={{ padding: "8px 6px", borderBottom: "2px solid #e2e8f0" }}>90 days late</th>
                <th style={{ padding: "8px 6px", borderBottom: "2px solid #e2e8f0" }}>Fixed cost</th>
              </tr>
            </thead>
            <tbody>
              {[1000, 5000, 10000, 25000].map((amt) => (
                <tr key={amt} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "9px 6px", fontWeight: 600 }}>{fmt(amt)}</td>
                  <td style={{ padding: "9px 6px" }} translate="no">{fmt(amt * daily)}</td>
                  <td style={{ padding: "9px 6px" }} translate="no">{fmt(amt * daily * 30)}</td>
                  <td style={{ padding: "9px 6px" }} translate="no">{fmt(amt * daily * 90)}</td>
                  <td style={{ padding: "9px 6px" }}>{fmt(penalty(amt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>For your own figures, the <a href="/calculator">late payment interest calculator</a> works it out to the day, and the <a href="/late-payment-letter-template">letter generator</a> puts it in a demand letter.</p>

          <h2>How the statutory late payment rate is set</h2>
          <p>The <a href="/guides/late-payment-act-1998-explained">Late Payment of Commercial Debts (Interest) Act 1998</a> sets interest at 8 percentage points over the Bank of England base rate. To stop the rate on a running debt changing every time the Bank moves, the Act uses a <strong>reference rate</strong> fixed twice a year:</p>
          <ul>
            <li>The base rate on <strong>31 December</strong> applies to invoices that become overdue between 1 January and 30 June.</li>
            <li>The base rate on <strong>30 June</strong> applies to invoices that become overdue between 1 July and 31 December.</li>
          </ul>
          <p>So a base rate cut in March does not reduce the interest on an invoice that went overdue in February, and a rise in August does not increase it either. The rate is locked for each debt by the half-year in which it fell due.</p>

          <h2>Who can charge it</h2>
          <p>Any business, sole trader or freelancer whose customer is also a business or public body, in England, Wales, Scotland or Northern Ireland. It does not apply to invoices to consumers. There is no minimum invoice value and no need for a late payment clause in your terms: the right exists by default. See <a href="/guides/freelancer-rights-late-payment">your rights when a client pays late</a>.</p>

          <h2>Frequently asked questions</h2>
          <div className={s.faqList}>
            {RATE_FAQS.map(({ q, a }) => {
              const isOpen = openFaq === q
              return (
                <div key={q} className={s.faqItem}>
                  <button onClick={() => setOpenFaq(isOpen ? null : q)} className={s.faqBtn}>
                    <h3 className={s.faqQuestion}>{q}</h3>
                    <span className={s.faqToggle}>{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && <div className={s.faqAnswer}>{a}</div>}
                </div>
              )
            })}
          </div>
        </div>

        <div className={s.cta}>
          <div className={s.ctaTitle}>Hielda applies this rate for you, to the day</div>
          <p className={s.ctaText}>
            Every chase email states the interest and fixed cost owed on that day, at the right reference rate, and the total keeps growing until the client pays.
          </p>
          <button onClick={() => { trackEvent("rate_page_cta_clicked", { placement: "bottom" }); onGetStarted() }} className={s.ctaBtn}>
            Start your free 6-week trial
          </button>
          <p className={s.ctaSmall}>No credit card required</p>
        </div>
      </article>
    </main>
  )
}
