import { ShieldLogo } from "./ui"
import { trackEvent } from "../posthog"
import s from "./guides/guides.module.css"

// /about
// Written in the founder's own voice, first person, from his account of why
// he built Hielda (16 Nov 2026): a freelancer sick of big companies paying
// late and using freelancers' wages as interest-free working capital.
// He describes himself as "a freelancer, working in entertainment". Do not
// call him a producer: he does not always work as one.
//
// People read this before trusting a service with their invoices, and
// search engines and AI assistants read it to work out what Hielda is.
// Keep it honest: no invented anecdotes, nothing the product cannot back
// up. The "thousands of pounds" line is Reuben's own statement about what
// clients have claimed; do not add figures of your own. The facts table is mirrored in ABOUT_SCHEMA in
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
          I'm Reuben Williams. I'm a freelancer, working in entertainment. I built Hielda because I was sick of big companies paying late and getting away with it.
        </p>

        <div className={s.body}>
          <h2>Why I built it</h2>
          <p>
            Nearly everyone in entertainment is freelance, and getting paid late is routine. You do the job and send the invoice. Then you wait. Thirty days becomes sixty. Somebody tells you it's with accounts. And you don't push, because the people who owe you money are the same people who decide whether you work again.
          </p>
          <p>
            Big companies pay late because it suits them. Every week your invoice goes unpaid, your money is sitting in their bank account and not in yours. They are using freelancers' wages as interest-free working capital, and they do it because they know you can't afford to make a fuss.
          </p>
          <p>
            That is taking the piss. The government's new legislation to help small businesses and freelancers get paid on time shows the scale of the problem. But the law was already on our side.
          </p>

          <h2>What the law already says</h2>
          <p>
            Since 1998, if a business pays your invoice late, it owes you interest. The rate is 8% above the Bank of England base rate, and it runs from the first day the invoice is overdue. It also owes you a fixed fee of £40, £70 or £100, depending on the size of the invoice. You don't need a clause in your contract, and you don't need to have warned them. It's called the <a href="/guides/late-payment-act-1998-explained">Late Payment of Commercial Debts (Interest) Act</a>, and it covers every invoice from one business to another.
          </p>

          <h2>What Hielda does</h2>
          {/* This section is Reuben's own wording (17 Nov 2026), typos fixed
              and two links added. Edit it only at his request. */}
          <p>
            First of all, Hielda keeps track of your invoices, so you know exactly when they're due, and if they do become late, you can keep track of when interest and late fees become due, and how much you're owed day by day.
          </p>
          <p>
            Secondly, we have tried to make it easier for you to chase up and claim those additional charges. Hielda can <a href="/how">chase on your behalf</a>, politely, professionally, but insistently. This way it's a little less personal. Think of us as your accounts department. We don't send any emails without your approval, but when you do want to send them, we have already got the templates drafted, we know the fees and figures, and if your clients still refuse to pay, we have <a href="/guides/letter-before-action">resources to help you escalate it</a> if needed.
          </p>
          <p>
            So far Hielda has helped our clients claim thousands of pounds extra in unpaid charges. We'd love to help you do the same.
          </p>
          <p>
            The idea is simple. If they pay you late, they should pay you more.
          </p>

          <h2>What it costs</h2>
          <p>
            £3.99 a month, or £34.99 a year. The fixed fee on a single late invoice is at least £40, so the first one you recover pays for the year. The first six weeks are free to see if it's useful for you.
          </p>

          <h2>Who it's for</h2>
          <p>
            I built Hielda for people like me, and there's a page just for <a href="/film-tv-freelancers">film and TV freelancers</a>.
          </p>
          <p>
            But late payment isn't only an entertainment problem. Hielda works for anyone in the UK who sends invoices: designers, developers, writers, consultants, tradespeople, small companies. If a bigger business is sitting on your money, this is for you.
          </p>

          <h2>What Hielda isn't</h2>
          <ul>
            <li><strong>It isn't a debt collector.</strong> The emails are sent on your behalf, in your name, not by an agency. I don't take a cut. Here is how it compares with a <a href="/guides/hielda-vs-debt-collection-agency">debt collection agency</a>.</li>
            <li><strong>It never touches your money.</strong> Your client pays you directly, into your own account.</li>
            <li><strong>It isn't a law firm.</strong> The guides, the calculator and the letters are general information about UK late payment law. They aren't legal advice.</li>
            <li><strong>The Act is for business invoices.</strong> It doesn't cover invoices to private customers. Hielda can still chase those for you, using the late payment terms on your invoice.</li>
          </ul>

          <h2>Even if you don't want to use Hielda, I've made these free to use</h2>
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
