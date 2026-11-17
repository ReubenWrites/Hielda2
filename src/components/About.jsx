import { ShieldLogo } from "./ui"
import { trackEvent } from "../posthog"
import s from "./guides/guides.module.css"

// /about
// Written in the founder's own voice, first person, from his account of why
// he built Hielda (16 Nov 2026): a freelancer sick of big companies paying
// late and using freelancers' wages as interest-free working capital.
//
// People read this before trusting a service with their invoices, and
// search engines and AI assistants read it to work out what Hielda is.
// Keep it honest: no invented anecdotes, no customer numbers, nothing the
// product cannot back up. The facts table is mirrored in ABOUT_SCHEMA in
// src/data/seoRoutes.js; change both together.

const FACTS = [
  ["What it is", "An online service that chases late invoices for UK freelancers and small businesses"],
  ["What it adds", "Statutory interest and the fixed fee under the Late Payment of Commercial Debts (Interest) Act 1998"],
  ["Who it is for", "Freelancers, sole traders, contractors and small companies in the UK"],
  ["Price", "£3.99 a month or £34.99 a year"],
  ["Free trial", "Six weeks, no card required"],
  ["Founder", "Reuben Williams"],
  ["Launched", "2026"],
  ["Based in", "United Kingdom"],
  ["Contact", "support@hielda.com"],
]

export default function About({ onBack, onGetStarted }) {
  const go = (fn) => (e) => { e.preventDefault(); fn() }
  const start = (placement) => () => { trackEvent("about_cta_clicked", { placement }); onGetStarted() }

  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <a href="/" className={s.navLogo} onClick={go(onBack)} style={{ textDecoration: "none", color: "inherit" }}>
          <ShieldLogo size={28} />
          <span className={s.navLogoText}>Hielda</span>
        </a>
        <button onClick={start("nav")} className={s.navTrialBtn}>Start Free Trial</button>
      </nav>

      <article className={s.article}>
        <nav className={s.breadcrumbs} aria-label="Breadcrumb">
          <a href="/" onClick={go(onBack)}>Home</a>{" · "}<span>About</span>
        </nav>

        <h1 className={s.title}>About Hielda</h1>
        <p className={s.lede}>
          I'm Reuben Williams. I'm a freelancer, and I built Hielda because I was sick of big companies paying late and getting away with it.
        </p>

        <div className={s.body}>
          <h2>Why I built it</h2>
          <p>
            I work in film and TV, as a producer. Nearly everyone in the industry is freelance, and getting paid late is routine. You do the job and send the invoice. Then you wait. Thirty days becomes sixty. Somebody tells you it's with accounts. And you don't push, because the people who owe you money are the same people who decide whether you work again.
          </p>
          <p>
            Everyone treats this as normal. It isn't. Big companies pay late because it suits them. Every week your invoice goes unpaid, your money is sitting in their bank account and not in yours. They are using freelancers' wages as interest-free working capital, and they do it because they know you can't afford to make a fuss.
          </p>
          <p>
            That is taking the piss. As it turns out, the law thinks so too.
          </p>

          <h2>What the law already says</h2>
          <p>
            Since 1998, if a business pays your invoice late, it owes you interest. The rate is 8% above the Bank of England base rate, and it runs from the first day the invoice is overdue. It also owes you a fixed fee of £40, £70 or £100, depending on the size of the invoice. You don't need a clause in your contract, and you don't need to have warned them. It's called the <a href="/guides/late-payment-act-1998-explained">Late Payment of Commercial Debts (Interest) Act</a>, and it covers every invoice from one business to another.
          </p>
          <p>
            Hardly anyone claims it. To do it yourself you have to work out the interest day by day, then send a run of awkward emails to someone you'd quite like to hire you again. Most freelancers decide it's easier to keep waiting, which is exactly what the late payers are counting on.
          </p>

          <h2>What Hielda does</h2>
          <p>
            Hielda does the asking, so you don't have to.
          </p>
          <p>
            You add an invoice. Hielda sends a couple of polite reminders before it's due. If the due date passes, it starts chasing, a little firmer each time, with the interest and the fixed fee added and worked out again every day. At 30 days overdue it drafts a <a href="/guides/letter-before-action">Letter Before Action</a>, which is the formal letter that comes before a court claim, ready for you to send.
          </p>
          <p>
            It all goes out in your name, and you're copied on every email. Nothing is sent until you've approved it, and you can pause any invoice whenever you like. The full schedule is on <a href="/how">how Hielda works</a>.
          </p>
          <p>
            The idea is simple. If they pay you late, they should pay you more.
          </p>

          <h2>What it costs</h2>
          <p>
            £3.99 a month, or £34.99 a year. The first six weeks are free and I don't ask for a card. There's no commission and no percentage of what you get back. The fixed fee on a single late invoice is at least £40, so the first one you recover pays for the year.
          </p>

          <h2>Who it's for</h2>
          <p>
            I built Hielda for people like me, and there's a page just for <a href="/film-tv-freelancers">film and TV freelancers</a>. So far it has been used or trialled by people in acting, camera, sound, lighting, production and costume.
          </p>
          <p>
            But late payment isn't a film problem. Hielda works for anyone in the UK who sends invoices: designers, developers, writers, consultants, tradespeople, small companies. If a bigger business is sitting on your money, this is for you.
          </p>

          <h2>What Hielda isn't</h2>
          <ul>
            <li><strong>It isn't a debt collector.</strong> The emails are sent on your behalf, in your name, not by an agency. I don't take a cut. Here is how it compares with a <a href="/guides/hielda-vs-debt-collection-agency">debt collection agency</a>.</li>
            <li><strong>It never touches your money.</strong> Your client pays you directly, into your own account.</li>
            <li><strong>It isn't a law firm.</strong> The guides, the calculator and the letters are general information about UK late payment law. They aren't legal advice.</li>
            <li><strong>The Act is for business invoices.</strong> It doesn't cover invoices to private customers. Hielda can still chase those for you, using the late payment terms on your invoice.</li>
          </ul>

          <h2>You don't have to pay me to use the law</h2>
          <p>
            Everything you need to claim what you're owed by hand is here, free, with no account.
          </p>
          <ul>
            <li><a href="/calculator">Late payment interest calculator</a>: what you can add to an overdue invoice today.</li>
            <li><a href="/late-payment-letter-template">Late payment letter generator</a>: a formal demand with your figures filled in.</li>
            <li><a href="/free-invoice-template-uk">Free UK invoice template</a>: with the late payment clause already on it.</li>
            <li><a href="/late-payment-interest-rate">Current late payment interest rate</a>: today's rate and how it's set.</li>
            <li><a href="/guides">All the guides</a>: letter templates and plain-English explainers on getting paid.</li>
          </ul>

          <h2>Hielda at a glance</h2>
          <table className={s.timeline}>
            <tbody>
              {FACTS.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{label === "Contact" ? <a href="mailto:support@hielda.com">{value}</a> : value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Get in touch</h2>
          <p>
            Email <a href="mailto:support@hielda.com">support@hielda.com</a>, whether it's a question, a problem, press or anything else. You'll hear back within two working days. The <a href="/privacy">privacy policy</a> and <a href="/terms">terms of service</a> cover how your data is handled and what you can expect from Hielda.
          </p>
        </div>

        <div className={s.cta}>
          <div className={s.ctaTitle}>If they pay you late, they should pay you more</div>
          <p className={s.ctaText}>
            Add an invoice and let Hielda do the asking. Six weeks free, no card.
          </p>
          <button onClick={start("bottom")} className={s.ctaBtn}>Start your free 6-week trial</button>
          <p className={s.ctaSmall}>£3.99 a month or £34.99 a year after the trial</p>
        </div>
      </article>
    </main>
  )
}
