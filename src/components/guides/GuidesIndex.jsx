import { ShieldLogo } from "../ui"
import s from "./guides.module.css"

const GUIDES = [
  {
    href: "/guides/late-payment-act-1998-explained",
    title: "The Late Payment Act 1998 — explained for freelancers and SMEs",
    desc: "A plain-English guide to the UK statute that gives every business the automatic right to charge statutory interest and a fixed debt recovery cost on overdue B2B invoices.",
  },
  {
    href: "/guides/how-to-chase-late-invoices",
    title: "How to chase late invoices — a practical playbook for UK freelancers",
    desc: "Day-by-day timeline used by professional accounts teams, adapted for solo freelancers and small businesses. Covers gentle reminders, formal letters, and when to escalate.",
  },
  {
    href: "/calculator",
    title: "Late payment interest calculator",
    desc: "Free tool — plug in any overdue invoice and see what you're legally owed in statutory interest and the fixed debt recovery cost.",
  },
  {
    href: "/late-payment-letter-template",
    title: "Free late payment demand letter template",
    desc: "Professionally-worded letter you can send to any UK B2B client, citing the Act and putting the debtor on formal notice.",
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
