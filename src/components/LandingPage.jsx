import { useState } from "react"
import {
  ShieldCheck, Scale, MailCheck, CalendarClock, Coins, Lock,
  Landmark, MessageSquareWarning, UserRound, Building2, Brush, Check,
} from "lucide-react"
import { getRate, getBoe } from "../constants"
import { calcInterest, fmt, round2 } from "../utils"
import { ShieldLogo } from "./ui"
import { LANDING_FAQS } from "../data/faqs"
import s from "./LandingPage.module.css"

const FEATURES = [
  {
    Ico: ShieldCheck,
    title: "Automatic Chase Emails",
    desc: "From friendly reminders to formal legal notices — Hielda sends escalating chase emails on your behalf so you don't have to.",
  },
  {
    Ico: Scale,
    title: "Statutory Interest & Fines",
    desc: "Under the Late Payment of Commercial Debts Act 1998, you're legally entitled to charge interest and penalties. Hielda calculates and enforces them for you.",
  },
  {
    Ico: MailCheck,
    title: "Check-in Before Every Step",
    desc: "We always ask you first — 'Has your client paid?' — before sending the next chase. You stay in full control.",
  },
  {
    Ico: CalendarClock,
    title: "19-Stage Chase Timeline",
    desc: "From 5 days before the due date to 30 days overdue. The pressure builds gradually, giving your client every chance to pay.",
  },
  {
    Ico: Coins,
    title: "You Keep Every Penny",
    desc: "Interest and penalties are yours by law. Hielda ensures you receive every pound you're entitled to.",
  },
  {
    Ico: Lock,
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
  // FAQPage JSON-LD is baked into the static HTML by scripts/prerender.mjs at
  // build time — Google reads it on first crawl with no JS required, which
  // the previous client-side useEffect injection couldn't guarantee.
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <main className={s.page}>
      {/* Nav bar */}
      <nav className={s.nav}>
        <div className={s.navLogo}>
          <ShieldLogo size={28} />
          <span className={s.navLogoText}>Hielda</span>
        </div>
        <div className={s.navActions}>
          <a href="/guides" className={s.navCalcBtn}>
            Guides
          </a>
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
      <div className={s.heroWrap}>
        {/* Oversized ghosted brand shield — the detailed knotwork artwork
            (white PNG rendered in brand blue via CSS mask), same watermark
            motif as the app sidebar. The simple SVG logo reads as too
            basic at this scale. */}
        <div className={s.heroShield} aria-hidden="true" />
        <section className={s.hero}>
          <div className={s.heroBadge}>
            UK Late Payment Act 1998
          </div>
          <h1 className={s.heroTitle}>
            They're using your wages as their working capital.<br />
            <span className={s.heroAccent}>Time to charge for it.</span>
          </h1>
          <p className={s.heroSubtitle}>
            Hielda chases your late invoices on your behalf. It automatically adds the statutory interest and fees you're entitled to under UK law.
            <br />
            <strong>If they're going to pay you late, they pay you more.</strong>
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

          {/* Press mention — third-party validation right under the CTA. */}
          <a
            href="https://marketspy.com/news/the-startup-helping-uk-freelancers-get-paid-without-the-awkward-chase-jb0kt"
            target="_blank"
            rel="noopener noreferrer"
            className={s.pressStrip}
          >
            <span className={s.pressLabel}>As featured in</span>
            <span className={s.pressName}>MarketSpy</span>
            <span className={s.pressQuote}>"The startup helping UK freelancers get paid — without the awkward chase"</span>
          </a>

          {/* Product visual: an illustrative chase email so the page shows
              the product doing its job instead of only describing it. The
              figures are real maths (£3,000 at the live statutory rate). */}
          <div className={s.heroVisual} aria-hidden="true">
            <div className={s.mockEmail}>
              <div className={s.mockEmailHeader}>
                <div className={s.mockAvatar}><ShieldLogo size={18} /></div>
                <div className={s.mockMeta}>
                  <div className={s.mockFrom}>Hielda — on behalf of Taylor Design Studio</div>
                  <div className={s.mockTo}>to: accounts@acme-agency.co.uk</div>
                </div>
                <div className={s.mockDay}>14 days overdue</div>
              </div>
              <div className={s.mockSubject}>Invoice INV-204 — statutory charges now applied</div>
              <p className={s.mockBody}>
                Invoice INV-204 remains unpaid. Under the Late Payment of Commercial Debts
                (Interest) Act 1998, the following charges now apply and accrue daily:
              </p>
              <div className={s.mockTable}>
                <div className={s.mockRow}><span>Original invoice</span><span>{fmt(3000)}</span></div>
                <div className={s.mockRow}><span>Fixed debt recovery cost</span><span className={s.mockCharge}>+ {fmt(70)}</span></div>
                <div className={s.mockRow}><span>Interest (14 days at {getRate()}% p.a.)</span><span className={s.mockCharge}>+ {fmt(calcInterest(3000, 14))}</span></div>
                <div className={s.mockTotalRow}><span>Now due</span><span>{fmt(round2(3070 + calcInterest(3000, 14)))}</span></div>
              </div>
            </div>
            <div className={s.mockPaidChip}>
              <Check size={14} strokeWidth={3} /> Paid in full, 3 days later
            </div>
          </div>
        </section>
      </div>

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
              Ico: Landmark,
              title: "They do it on purpose",
              desc: "Large companies routinely delay paying freelancers by 30, 60, even 90 days. Your unpaid invoice is an interest-free loan — and their finance team knows exactly what they're doing.",
            },
            {
              Ico: MessageSquareWarning,
              title: "You can't push back",
              desc: "You're legally entitled to charge statutory interest and fixed penalties. But asking your client directly risks souring the relationship, losing future work, and making every future email awkward. So most freelancers stay quiet — and never see that money.",
            },
            {
              Ico: Scale,
              title: "The law is on your side",
              desc: `Under the Late Payment of Commercial Debts Act 1998, every overdue B2B invoice automatically accrues interest at ${getRate()}% p.a. plus a fixed debt recovery cost of £40–£100. Most freelancers never claim it.`,
            },
          ].map((f) => (
            <div key={f.title} className={s.problemCard}>
              <div className={s.cardIcoChip}><f.Ico size={19} /></div>
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
                  <div className={s.avatarBlue}><UserRound size={17} /></div>
                  <div>
                    <div className={s.solutionCardRowTitle}>The person who hired you</div>
                    <div className={s.solutionCardRowSub}>Loves your work. Not responsible for payment.</div>
                  </div>
                </div>
                <div className={s.solutionCardRow}>
                  <div className={s.avatarYellow}><Building2 size={17} /></div>
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
                  <div className={s.avatarBlue}><Brush size={17} /></div>
                  <div>
                    <div className={s.solutionCardRowTitle}>You</div>
                    <div className={s.solutionCardRowSub}>Do great work. Maintain the relationship.</div>
                  </div>
                </div>
                <div className={s.solutionCardRow}>
                  <div className={s.avatarBlue}><ShieldLogo size={20} /></div>
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
        <img src="/shield-d6-single.png?v=2" alt="" className={s.statsShield} aria-hidden="true" />
        {[
          { val: `${getRate()}%`, label: "Statutory interest rate" },
          { val: "£40–100", label: "Fixed recovery cost per invoice" },
          { val: "19", label: "Chase stages over 30 days" },
          { val: "6 years", label: "To claim what you're owed" },
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
              <div className={s.cardIcoChip}><f.Ico size={18} /></div>
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

      {/* Debt recovery cost breakdown */}
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
            { label: "Original invoice", val: fmt(3000), col: "var(--tx)" },
            { label: "Fixed debt recovery cost", val: `+ ${fmt(70)}`, col: "var(--or)" },
            { label: `Interest (30 days at ${getRate()}% p.a.)`, val: `+ ${fmt(calcInterest(3000, 30))}`, col: "var(--or)" },
          ].map((r) => (
            <div key={r.label} className={s.penaltyRow}>
              <span className={s.penaltyRowLabel}>{r.label}</span>
              <span className={s.penaltyRowVal} style={{ color: r.col }}>{r.val}</span>
            </div>
          ))}
          <div className={s.penaltyTotal}>
            <span className={s.penaltyTotalLabel}>Total owed to you</span>
            <span className={s.penaltyTotalVal}>{fmt(round2(3070 + calcInterest(3000, 30)))}</span>
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
                <span className={s.includedCheck}><Check size={13} strokeWidth={3} /></span> {f}
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
        <img src="/shield-d6-single.png?v=2" alt="" className={s.ctaShieldBg} aria-hidden="true" />
        <div className={s.ctaShieldMark} aria-hidden="true">
          <ShieldLogo size={42} white />
        </div>
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

      {/* Footer nav — crawlable links to every guide and free tool.
          This is the main internal-linking surface for SEO: the landing
          page has the most authority, and these links pass it down to
          the long-tail guide pages. */}
      <section className={s.footerNav} aria-label="Site links">
        <div className={s.footerNavCol}>
          <div className={s.footerNavHeading}>Free tools</div>
          <a href="/calculator" className={s.footerNavLink}>Late payment interest calculator</a>
          <a href="/late-payment-letter-template" className={s.footerNavLink}>Late payment letter generator</a>
        </div>
        <div className={s.footerNavCol}>
          <div className={s.footerNavHeading}>Guides</div>
          <a href="/guides/client-not-paying-invoice" className={s.footerNavLink}>Client not paying? What to do</a>
          <a href="/guides/how-to-chase-late-invoices" className={s.footerNavLink}>How to chase late invoices</a>
          <a href="/guides/how-much-interest-late-invoice" className={s.footerNavLink}>How much interest can you charge?</a>
          <a href="/guides/letter-before-action" className={s.footerNavLink}>Letter Before Action</a>
        </div>
        <div className={s.footerNavCol}>
          <div className={s.footerNavHeading}>More guides</div>
          <a href="/guides/freelancer-rights-late-payment" className={s.footerNavLink}>Your late payment rights</a>
          <a href="/guides/small-claims-court-unpaid-invoice" className={s.footerNavLink}>Small claims court — worth it?</a>
          <a href="/guides/invoice-payment-terms-uk" className={s.footerNavLink}>Payment terms: 30, 14, or 7 days?</a>
          <a href="/guides/late-payment-act-1998-explained" className={s.footerNavLink}>The Late Payment Act, explained</a>
        </div>
        <div className={s.footerNavCol}>
          <div className={s.footerNavHeading}>Hielda</div>
          <a href="/how" className={s.footerNavLink}>How it works</a>
          <a href="/guides" className={s.footerNavLink}>All guides</a>
          <a href="/privacy" className={s.footerNavLink}>Privacy policy</a>
          <a href="mailto:support@hielda.com" className={s.footerNavLink}>support@hielda.com</a>
          {/* Product Hunt badge — launched 2 Sep 2026 */}
          <a
            href="https://www.producthunt.com/products/hielda?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-hielda"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 10, display: "inline-block" }}
          >
            <img
              alt="Hielda - Winning interest & fees for freelancers on late invoices | Product Hunt"
              width="250"
              height="54"
              style={{ maxWidth: "100%", height: "auto" }}
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1235052&theme=light&t=1787929808370"
            />
          </a>
          {/* TechBase Directory featured badge — paid listing, their
              listing page links back dofollow; the embed keeps the
              featured status valid. */}
          <a
            href="https://techbasedirectory.com/product/hielda?utm_source=featured_embed"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 8, display: "inline-block" }}
          >
            <img
              src="https://techbasedirectory.com/api/featured-embed"
              alt="Hielda | Techbasedirectory.com"
              width="200"
              height="60"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </a>
        </div>
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
