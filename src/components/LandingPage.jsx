import { useEffect, useState } from "react"
import { getRate, getBoe } from "../constants"
import { ShieldLogo } from "./ui"
import s from "./LandingPage.module.css"

const LANDING_FAQS = [
  {
    q: "My client hasn't paid my invoice — what can I do?",
    a: "Under the Late Payment of Commercial Debts Act 1998, you have the legal right to charge statutory interest at 8% above the Bank of England base rate, plus a fixed penalty of £40–£100 on every overdue B2B invoice. You can send formal chase emails, add these charges automatically, and escalate to a legal notice if needed. Hielda automates this entire process so you never have to ask awkwardly for your own money.",
  },
  {
    q: "How long can a client legally take to pay an invoice in the UK?",
    a: "By default, payment is due within 30 days for business-to-business transactions. If no payment terms are agreed, the 30-day statutory period applies automatically. Once that period expires, the invoice is legally overdue and statutory interest begins to accrue daily.",
  },
  {
    q: "Can I charge interest on an overdue invoice in the UK?",
    a: "Yes. Under the Late Payment of Commercial Debts Act 1998, you are legally entitled to charge interest at 8% above the Bank of England base rate on any overdue B2B invoice. This right applies automatically — you don't need to have stated it on your original invoice or in your contract.",
  },
  {
    q: "What late payment penalties can I charge?",
    a: "The Act entitles you to a fixed debt recovery cost on top of interest: £40 for invoices under £1,000, £70 for invoices between £1,000 and £9,999, and £100 for invoices of £10,000 or more. These apply per invoice, in addition to the daily interest that accrues.",
  },
  {
    q: "How do I chase a late invoice without damaging the client relationship?",
    a: "The key is separating the personal relationship from the commercial process. Your client receives formal notices from a third party acting on your behalf — it's not personal, it's just business. This is exactly how large companies operate: the person who commissioned your work and the accounts department are completely separate teams. You stay the good guy; Hielda handles the uncomfortable part.",
  },
  {
    q: "Does the Late Payment Act apply to my invoices?",
    a: "The Act applies to business-to-business (B2B) transactions — both parties must be acting in the course of a business. It does not cover invoices to consumers. It applies throughout the UK and covers most commercial contracts, including freelance and contractor work.",
  },
  {
    q: "Why is Hielda better than just chasing clients myself?",
    a: "When you chase a client yourself, you're asking a favour from someone whose goodwill you depend on. Every email you send puts you in an awkward position — too soft and they ignore it, too firm and you risk the relationship. Hielda removes you from the equation entirely. Your client hears from a third party acting on your behalf, which carries far more weight and creates no personal friction. You stay professional, they feel the pressure, and you never have to have an uncomfortable conversation.",
  },
  {
    q: "How does Hielda protect me from blowback from my client?",
    a: "Hielda acts as your outsourced accounts team — a third party that handles all the chasing and applies charges on your behalf. Your client receives formal notices from that third party, not from you personally. This gives them a face-saving way to pay without either of you having to acknowledge an awkward dynamic. If a client pushes back, you can truthfully say 'my outsourced accounting team applies those charges automatically to anyone who pays late — it's nothing personal.' That's a very different conversation from having to ask for your money yourself.",
  },
  {
    q: "I invoice both businesses and homeowners — can Hielda help with both?",
    a: "Yes. Hielda supports both B2B and consumer invoicing. For business clients, the full Late Payment Act applies automatically — statutory interest and fixed penalties. For consumer clients (individuals, homeowners), you can toggle 'Consumer' when creating an invoice and Hielda will add contractual payment terms to the invoice, including interest at the same rate. The chase sequence runs identically — your client still receives the full escalation sequence. This is particularly useful for tradespeople, contractors, and anyone who works for both companies and individuals.",
  },
  {
    q: "Is it true that companies really delay payment on purpose?",
    a: "Yes — and it's well documented. Large companies routinely use extended payment terms (60, 90, even 120 days) as a cash flow management strategy, effectively using suppliers as interest-free lenders. A 2023 report by the Federation of Small Businesses found that 52% of UK small businesses were paid late, with the average overdue amount exceeding £8,500. For large businesses, delaying payment to freelancers and SMEs is a deliberate financial decision made by accounts departments — the person who hired you often has no idea it's happening.",
  },
]

const FEATURES = [
  {
    ico: "🛡️",
    title: "Automatic Chase Emails",
    desc: "From friendly reminders to formal legal notices — Hielda sends escalating chase emails on your behalf so you don't have to.",
  },
  {
    ico: "⚖️",
    title: "Statutory Interest & Fines",
    desc: "Under the Late Payment of Commercial Debts Act 1998, you're legally entitled to charge interest and penalties. Hielda calculates and enforces them for you.",
  },
  {
    ico: "📧",
    title: "Check-in Before Every Step",
    desc: "We always ask you first — 'Has your client paid?' — before sending the next chase. You stay in full control.",
  },
  {
    ico: "📊",
    title: "19-Stage Chase Timeline",
    desc: "From 5 days before the due date to 30 days overdue. The pressure builds gradually, giving your client every chance to pay.",
  },
  {
    ico: "💰",
    title: "You Keep Every Penny",
    desc: "Interest and penalties are yours by law. Hielda ensures you receive every pound you're entitled to.",
  },
  {
    ico: "🔒",
    title: "Secure & Professional",
    desc: "AES-256 encryption, TLS in transit, and row-level access controls. Your data is protected to bank-grade standards.",
  },
]

const TIMELINE_PREVIEW = [
  { day: "Day -5", label: "Friendly Reminder", col: "#1e5fa0" },
  { day: "Day -1", label: "Second Reminder", col: "#2d72b8" },
  { day: "Day 0", label: "Final Warning", col: "#b45309" },
  { day: "Day +1", label: "Fines Applied", col: "#d97706" },
  { day: "Day +6–25", label: "Regular Chasing", col: "#c2410c" },
  { day: "Day +26–29", label: "Daily Escalation", col: "#7f1d1d" },
  { day: "Day +30", label: "Final Notice", col: "#7f1d1d" },
]

export default function LandingPage({ onGetStarted, onPrivacy, onCalculator, isMobile }) {
  const [openFaq, setOpenFaq] = useState(null)

  useEffect(() => {
    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.id = "faq-schema-landing"
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": LANDING_FAQS.map(({ q, a }) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a },
      })),
    })
    document.head.appendChild(script)
    return () => document.getElementById("faq-schema-landing")?.remove()
  }, [])

  return (
    <main className={s.page}>
      {/* Nav bar */}
      <nav className={s.nav}>
        <div className={s.navLogo}>
          <ShieldLogo size={28} />
          <span className={s.navLogoText}>Hielda</span>
        </div>
        <div className={s.navActions}>
          <button onClick={onCalculator} className={s.navCalcBtn}>
            Calculator
          </button>
          <button onClick={onGetStarted} className={s.navLoginBtn}>
            Log In
          </button>
          <button onClick={onGetStarted} className={s.navTrialBtn}>
            Start Free Trial
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className={s.hero}>
        <div className={s.heroBadge}>
          UK Late Payment Act 1998
        </div>
        <h1 className={s.heroTitle}>
          They're using your invoice<br />
          <span className={s.heroAccent}>as a free loan. Time to charge for it.</span>
        </h1>
        <p className={s.heroSubtitle}>
          Large companies deliberately delay paying freelancers — using your money as their interest-free working capital. We know that as an individual or small business, it can be hard to assert your right to payment on time — or to levy the fees and fines you're entitled to — when you can't afford to damage the relationship. That's why we chase on your behalf, and if they're late paying, we add the charges for you, so you never have to be the bad guy.
        </p>
        <div className={s.heroCtas}>
          <button onClick={onGetStarted} className={s.heroTrialBtn}>
            Start Free Trial
          </button>
          <button
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            className={s.heroOutlineBtn}
          >
            See How It Works
          </button>
        </div>
        <p className={s.heroSmall}>
          No credit card required · 6-week free trial · Cancel anytime
        </p>
      </section>

      {/* The Problem */}
      <section className={s.problemSection}>
        <h2 className={s.sectionTitle}>
          The trap every freelancer knows
        </h2>
        <p className={s.sectionSubtitle}>
          Late payment isn't an accident. It's a system — and it's designed to work against you.
        </p>
        <div className={s.problemGrid}>
          {[
            {
              ico: "🏦",
              title: "They do it on purpose",
              desc: "Large companies routinely delay paying freelancers by 30, 60, even 90 days. Your unpaid invoice is an interest-free loan — and their finance team knows exactly what they're doing.",
            },
            {
              ico: "😬",
              title: "You can't push back",
              desc: "You're legally entitled to charge statutory interest and fixed penalties. But asking your client directly risks souring the relationship, losing future work, and making every future email awkward. So most freelancers stay quiet — and never see that money.",
            },
            {
              ico: "⚖️",
              title: "The law is on your side",
              desc: `Under the Late Payment of Commercial Debts Act 1998, every overdue B2B invoice automatically accrues interest at ${getRate()}% p.a. plus a fixed penalty of £40–£100. Most freelancers never claim it.`,
            },
          ].map((f) => (
            <div key={f.title} className={s.problemCard}>
              <div className={s.problemCardIco}>{f.ico}</div>
              <div className={s.problemCardTitle}>{f.title}</div>
              <div className={s.problemCardDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The Solution — Trusted Third Party */}
      <section className={s.solutionSection}>
        <div className={s.solutionInner}>
          <h2 className={s.sectionTitle}>
            You stay the good guy. We do the rest.
          </h2>
          <p className={s.solutionSubtitle}>
            Think about how your client works. The person who hired you and their accounts department are completely separate teams. The accounts team chases invoices every day — it's nothing personal, it's just process. Now you have your own accounts department.
          </p>
          <div className={s.solutionGrid}>
            <div className={s.solutionCardTheir}>
              <div className={s.solutionCardLabelTheir}>Their side</div>
              <div className={s.solutionCardItems}>
                <div className={s.solutionCardRow}>
                  <div className={s.avatarBlue}>👤</div>
                  <div>
                    <div className={s.solutionCardRowTitle}>The person who hired you</div>
                    <div className={s.solutionCardRowSub}>Loves your work. Not responsible for payment.</div>
                  </div>
                </div>
                <div className={s.solutionCardRow}>
                  <div className={s.avatarYellow}>🏢</div>
                  <div>
                    <div className={s.solutionCardRowTitle}>Their accounts department</div>
                    <div className={s.solutionCardRowSub}>Delays payment. Applies pressure. Nothing personal.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={s.solutionEquals}>=</div>

            <div className={s.solutionCardYour}>
              <div className={s.solutionCardLabelYour}>Your side</div>
              <div className={s.solutionCardItems}>
                <div className={s.solutionCardRow}>
                  <div className={s.avatarBlue}>🎨</div>
                  <div>
                    <div className={s.solutionCardRowTitle}>You</div>
                    <div className={s.solutionCardRowSub}>Do great work. Maintain the relationship.</div>
                  </div>
                </div>
                <div className={s.solutionCardRow}>
                  <div className={s.avatarBlue}>🛡️</div>
                  <div>
                    <div className={s.solutionCardRowTitleAccent}>Hielda</div>
                    <div className={s.solutionCardRowSub}>Chases payment. Applies fines. Nothing personal.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className={s.solutionQuote}>
            "Our system has automatically applied statutory charges to your overdue invoice" is a very different conversation from "please pay me."
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className={s.statsBar}>
        {[
          { val: `${getRate()}%`, label: "Statutory interest rate" },
          { val: "£40–100", label: "Fixed penalty per invoice" },
          { val: "19", label: "Chase stages over 30 days" },
        ].map((stat) => (
          <div key={stat.label} className={s.statItem}>
            <div className={s.statVal}>{stat.val}</div>
            <div className={s.statLabel}>{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Features grid */}
      <section className={s.featuresSection}>
        <h2 className={s.sectionTitle}>
          Everything your accounts department would do
        </h2>
        <p className={s.sectionSubtitle}>
          Hielda handles the uncomfortable conversations so you never have to.
        </p>
        <div className={s.featuresGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={s.featureCard}>
              <div className={s.featureIco}>{f.ico}</div>
              <div className={s.featureTitle}>{f.title}</div>
              <div className={s.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Chase timeline preview */}
      <section id="how-it-works" className={s.timelineSection}>
        <div className={s.timelineInner}>
          <h2 className={s.sectionTitle}>
            How Hielda chases for you
          </h2>
          <p className={s.sectionSubtitle}>
            We check in with you before every step. You're always in control.
          </p>
          {TIMELINE_PREVIEW.map((step, i) => (
            <div key={i} className={i < TIMELINE_PREVIEW.length - 1 ? s.timelineRowBorder : s.timelineRow}>
              <div
                className={s.timelineDot}
                style={{ background: step.col, boxShadow: `0 0 0 3px ${step.col}20` }}
              />
              <div className={s.timelineDay} style={{ color: step.col }}>
                {step.day}
              </div>
              <div className={s.timelineLabel}>{step.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Penalty breakdown */}
      <section className={s.penaltySection}>
        <h2 className={s.sectionTitle}>
          What you're legally owed
        </h2>
        <p className={s.sectionSubtitle}>
          Under the Late Payment of Commercial Debts (Interest) Act 1998
        </p>
        <div className={s.penaltyTable}>
          <div className={s.penaltyHeader}>
            <span className={s.penaltyHeaderText}>Example: £3,000 invoice, 30 days late</span>
          </div>
          {[
            { label: "Original invoice", val: "£3,000.00", col: "var(--tx)" },
            { label: "Fixed penalty", val: "+ £40.00", col: "var(--or)" },
            { label: `Interest (30 days at ${getRate()}% p.a.)`, val: "+ £28.97", col: "var(--or)" },
          ].map((r) => (
            <div key={r.label} className={s.penaltyRow}>
              <span className={s.penaltyRowLabel}>{r.label}</span>
              <span className={s.penaltyRowVal} style={{ color: r.col }}>{r.val}</span>
            </div>
          ))}
          <div className={s.penaltyTotal}>
            <span className={s.penaltyTotalLabel}>Total owed to you</span>
            <span className={s.penaltyTotalVal}>£3,068.97</span>
          </div>
        </div>
        <button onClick={onCalculator} className={s.calcLink}>
          Try our free calculator with your own invoices →
        </button>
      </section>

      {/* Pricing */}
      <section className={s.pricingSection}>
        <h2 className={s.sectionTitle}>
          Simple, transparent pricing
        </h2>
        <p className={s.sectionSubtitle}>
          One late fee more than covers a year's subscription. Everything after that is profit.
        </p>
        <div className={s.pricingGrid}>
          {/* Monthly */}
          <div className={s.pricingCardMonthly}>
            <div className={s.pricingTier}>Monthly</div>
            <div className={s.pricingPriceWrap}>
              <span className={s.pricingPrice}>£3.99</span>
              <span className={s.pricingPer}>/month</span>
            </div>
            <p className={s.pricingNote}>
              Cancel anytime. No lock-in.
            </p>
            <button onClick={onGetStarted} className={s.pricingBtn}>
              Start Free Trial
            </button>
          </div>

          {/* Annual */}
          <div className={s.pricingCardAnnual}>
            <div className={s.pricingBadge}>Best value</div>
            <div className={s.pricingTier}>Annual</div>
            <div className={s.pricingPriceWrap}>
              <span className={s.pricingPrice}>£34.99</span>
              <span className={s.pricingPer}>/year</span>
            </div>
            <p className={s.pricingNote} style={{ marginBottom: 4 }}>
              Just £2.92/month — save 27%
            </p>
            <p className={s.pricingSave}>
              One recovered penalty covers your whole year.
            </p>
            <button onClick={onGetStarted} className={s.pricingBtn}>
              Start Free Trial
            </button>
          </div>
        </div>

        {/* Included features */}
        <div className={s.includedBox}>
          <div className={s.includedTitle}>Everything included in both plans:</div>
          <div className={s.includedGrid}>
            {[
              "19-stage automated chase sequence",
              "Statutory interest & penalty enforcement",
              "PDF invoice generation",
              "Chase history & audit trail",
              "You stay in full control — we check in first",
              "Email support",
            ].map(f => (
              <div key={f} className={s.includedItem}>
                <span className={s.includedCheck}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>
        <p className={s.pricingDisclaimer}>
          Full access during your 6-week trial — no card needed, no auto-charge · Cancel any time · UK businesses only
        </p>
        <p className={s.referralText}>
          Know a freelancer who'd benefit? <button onClick={onGetStarted} className={s.referralLink}>Sign up</button> and refer friends to earn £10 per referral.
        </p>
      </section>

      {/* FAQ */}
      <section className={s.faqSection}>
        <h2 className={s.sectionTitle}>
          Common questions about late payment
        </h2>
        <p className={s.faqSubtitle}>
          Everything you need to know about your rights as a UK freelancer or small business.
        </p>
        <div className={s.faqList}>
          {LANDING_FAQS.map(({ q, a }) => {
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
      </section>

      {/* CTA */}
      <section className={s.ctaSection}>
        <h2 className={s.ctaTitle}>
          You've done the work. Let Hielda make sure you're paid for it.
        </h2>
        <p className={s.ctaSubtitle}>
          Protect the relationship. Enforce your rights. Never leave money on the table again.
        </p>
        <button onClick={onGetStarted} className={s.ctaBtn}>
          Start Your Free Trial
        </button>
        <p className={s.ctaSmall}>
          No credit card required · 6-week free trial
        </p>
      </section>

      {/* Footer */}
      <footer className={s.footer}>
        <span>© {new Date().getFullYear()} Hielda. Protecting your pay.</span>
        <button onClick={onPrivacy} className={s.footerPrivacy}>
          Privacy Policy
        </button>
        <a href="mailto:support@hielda.com" className={s.footerEmail}>support@hielda.com</a>
      </footer>
    </main>
  )
}
