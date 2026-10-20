import { ShieldLogo } from "../ui"
import s from "./guides.module.css"

const GUIDES = [
  {
    href: "/guides/client-not-paying-invoice",
    title: "Client not paying your invoice? What to do, step by step",
    desc: "The practical escalation path when a client won't pay: ruling out admin slip-ups, polite chases, statutory charges, the Letter Before Action, and court — plus the mistakes to avoid.",
  },
  {
    href: "/guides/how-to-chase-late-invoices",
    title: "How to chase late invoices — a practical playbook for UK freelancers",
    desc: "Day-by-day timeline used by professional accounts teams, adapted for solo freelancers and small businesses. Covers gentle reminders, formal letters, and when to escalate.",
  },
  {
    href: "/guides/how-much-interest-late-invoice",
    title: "How much interest can you charge on a late invoice?",
    desc: "The statutory rate, the exact daily formula, the £40–£100 fixed recovery sums, and worked examples for typical invoice sizes.",
  },
  {
    href: "/guides/freelancer-rights-late-payment",
    title: "Your legal rights when a client pays late",
    desc: "UK law is unusually strong on late payment — statutory interest, fixed recovery costs, six years to claim, and court access without a solicitor. Most freelancers never use any of it.",
  },
  {
    href: "/guides/late-payment-act-1998-explained",
    title: "The Late Payment Act 1998 — explained for freelancers and SMEs",
    desc: "A plain-English guide to the UK statute that gives every business the automatic right to charge statutory interest and a fixed debt recovery cost on overdue B2B invoices.",
  },
  {
    href: "/guides/letter-before-action",
    title: "Letter Before Action — how and when to send one",
    desc: "The formal pre-court letter that gets most stubborn invoices paid: what it must contain, response windows, and how to send it properly.",
  },
  {
    href: "/guides/small-claims-court-unpaid-invoice",
    title: "Taking an unpaid invoice to small claims court — is it worth it?",
    desc: "An honest cost-benefit guide to Money Claim Online: fees, timelines, what happens after filing, and enforcement if they still don't pay.",
  },
  {
    href: "/guides/debt-collection-agency-vs-diy",
    title: "Debt collection agency, DIY, or automation?",
    desc: "What agencies actually charge and can actually do, when a solicitor's letter beats both, and an honest decision guide by how late the invoice is.",
  },
  {
    href: "/guides/invoice-payment-terms-uk",
    title: "Invoice payment terms: 30 days, 14, or 7?",
    desc: "What terms to use by client type, the 30-day legal default, the 60-day cap, and how to state terms so they actually stick.",
  },
  {
    href: "/guides/hielda-vs-chaser",
    title: "Hielda vs Chaser",
    desc: "Chaser is credit control for finance teams from £199 a month; Hielda is late payment enforcement for one person at £3.99. Who each suits, honestly.",
  },
  {
    href: "/guides/hielda-vs-debt-collection-agency",
    title: "Hielda vs a debt collection agency",
    desc: "Commission versus a flat fee, who has what powers (neither has special ones), timing, and the order to use them in.",
  },
  {
    href: "/guides/hielda-vs-doing-it-yourself",
    title: "Hielda vs doing it yourself",
    desc: "What a proper chase sequence involves by hand, the hours and the awkwardness, what Hielda takes over, and when DIY is still the right call.",
  },
  {
    href: "/guides/hielda-vs-xero-invoice-reminders",
    title: "Hielda vs accounting software reminders",
    desc: "What the built-in reminders in Xero, QuickBooks and FreeAgent send, what they leave out (interest, escalation, the formal letter), and when Hielda is worth adding.",
  },
  {
    href: "/calculator",
    title: "Late payment interest calculator",
    desc: "Free tool — plug in any overdue invoice and see what you're legally owed in statutory interest and the fixed debt recovery cost.",
  },
  {
    href: "/late-payment-letter-template",
    title: "Free late payment letter generator",
    desc: "Fill in your invoice details and get a ready-to-send demand letter with the statutory interest and fixed recovery cost calculated for you.",
  },
]

export default function GuidesIndex({ onBack, onGetStarted }) {
  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <div className={s.navLogo} onClick={onBack}>
          <ShieldLogo size={28} />
          <span className={s.navLogoText}>Hielda</span>
        </div>
        <button onClick={onGetStarted} className={s.navTrialBtn}>
          Start Free Trial
        </button>
      </nav>

      <article className={s.article}>
        <nav className={s.breadcrumbs} aria-label="Breadcrumb">
          <a onClick={onBack} style={{ cursor: "pointer" }}>Home</a>
          {" · "}
          <span>Guides</span>
        </nav>

        <header className={s.indexHeader}>
          <h1 className={s.indexTitle}>Guides for UK freelancers and SMEs</h1>
          <p className={s.indexSubtitle}>
            Plain-English explainers, tools, and templates for getting paid on time and enforcing what you're owed under UK law.
          </p>
        </header>

        <div className={s.relatedList}>
          {GUIDES.map(g => (
            <a key={g.href} href={g.href} className={s.relatedCard}>
              <h2 className={s.relatedCardTitle}>{g.title}</h2>
              <p className={s.relatedCardDesc}>{g.desc}</p>
            </a>
          ))}
        </div>

        <div className={s.cta}>
          <div className={s.ctaTitle}>Tired of chasing invoices yourself?</div>
          <p className={s.ctaText}>
            Hielda automatically sends chase emails, calculates statutory interest daily, and applies the fixed debt recovery cost — so you don't have to.
          </p>
          <button onClick={onGetStarted} className={s.ctaBtn}>
            Start your free 6-week trial
          </button>
          <p className={s.ctaSmall}>No credit card required</p>
        </div>
      </article>
    </main>
  )
}
