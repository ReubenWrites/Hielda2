import { useEffect, useState } from "react"
import { ShieldLogo } from "./ui"
import { getRate, loadLiveBoeRate, onRateChange } from "../constants"
import { trackEvent } from "../posthog"
import { FILM_TV_FAQS } from "../data/filmTvFaqs"
import g from "./guides/guides.module.css"
import s from "./FilmTvPage.module.css"

// /film-tv-freelancers
// A front door for film and TV crew. Same product, same sign-up and price
// as everywhere else; the copy speaks to how crew are actually paid (day
// rates, kit hire, PO numbers, productions that wrap and go quiet).
//
// Claims on this page are deliberately narrow:
//  - the departments list is the founder's own account of who has used or
//    trialled Hielda, and the wording says "used or trialled";
//  - the Act only covers people who invoice (sole trader / own company),
//    not PAYE crew, and the page says so rather than implying otherwise.

const fmt = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n)
const pct = (n) => `${Number(n).toFixed(2).replace(/\.?0+$/, "")}%`

const DEPARTMENTS = ["Acting", "Camera", "Sound", "Lighting", "Production", "Costume"]

// Worked example: five days at £350 plus a week's kit hire, paid 45 days late.
const EXAMPLE = { fee: 1750, kit: 400, days: 45 }

export default function FilmTvPage({ onBack, onGetStarted }) {
  const [rate, setRate] = useState(getRate())
  const [openFaq, setOpenFaq] = useState(null)

  useEffect(() => {
    const off = onRateChange(({ rate: r }) => setRate(r))
    loadLiveBoeRate()
    return off
  }, [])

  const go = (fn) => (e) => { e.preventDefault(); fn() }
  const start = (placement) => () => { trackEvent("film_tv_cta_clicked", { placement }); onGetStarted() }

  const invoice = EXAMPLE.fee + EXAMPLE.kit
  const interest = Math.round(invoice * (rate / 100) * (EXAMPLE.days / 365) * 100) / 100
  const fixed = invoice >= 10000 ? 100 : invoice >= 1000 ? 70 : 40

  return (
    <main className={g.page}>
      <nav className={g.nav}>
        <a href="/" className={g.navLogo} onClick={go(onBack)} style={{ textDecoration: "none", color: "inherit" }}>
          <ShieldLogo size={28} />
          <span className={g.navLogoText}>Hielda</span>
        </a>
        <button onClick={start("nav")} className={g.navTrialBtn}>Start Free Trial</button>
      </nav>

      <header className={s.hero}>
        <div className={s.heroInner}>
          <p className={s.eyebrow}>For film &amp; TV freelancers</p>
          <h1 className={s.h1}>The job wrapped weeks ago. Your invoice hasn&rsquo;t been paid.</h1>
          <p className={s.heroLede}>
            Hielda chases the production for you, politely at first and then formally, and adds the interest and
            late fee UK law says you are owed. You approve every email. Nobody has to be the difficult one.
          </p>
          <div className={s.heroBtns}>
            <button onClick={start("hero")} className={s.primaryBtn}>Start your free 6-week trial</button>
            <a href="/calculator" className={s.ghostLink}>See what a late invoice is owed</a>
          </div>
          <p className={s.heroSmall}>No card required · then £3.99 a month</p>
        </div>
      </header>

      <div className={s.wrap}>
        <section className={s.depts} aria-label="Who uses Hielda">
          <p className={s.deptsLabel}>
            Built by someone who works in production. Used or trialled by freelancers working in:
          </p>
          <ul className={s.deptChips}>
            {DEPARTMENTS.map((d) => <li key={d} className={s.deptChip}>{d}</li>)}
          </ul>
        </section>

        <section className={s.section}>
          <h2 className={s.h2}>Why crew invoices get paid late</h2>
          <p className={s.p}>
            It is rarely malice. The production office closes, the accountant moves to the next job, and your
            invoice sits in an inbox nobody is watching. And because the next job comes from the same handful of
            people, most crew wait far longer than they should before saying anything.
          </p>
          <div className={s.cards}>
            <div className={s.card}>
              <h3 className={s.cardTitle}>&ldquo;It&rsquo;s with accounts&rdquo;</h3>
              <p className={s.cardText}>Three emails in, you are still being told the payment run is next week.</p>
            </div>
            <div className={s.card}>
              <h3 className={s.cardTitle}>The office has gone quiet</h3>
              <p className={s.cardText}>The production wrapped and the people who hired you have moved on.</p>
            </div>
            <div className={s.card}>
              <h3 className={s.cardTitle}>You don&rsquo;t want to be awkward</h3>
              <p className={s.cardText}>You&rsquo;d like to work with them again, so the invoice drifts to 60, then 90 days.</p>
            </div>
          </div>
        </section>

        <section className={s.section}>
          <h2 className={s.h2}>What the law adds to a late crew invoice</h2>
          <p className={s.p}>
            If you invoice as a sole trader or through your own company, the{" "}
            <a href="/guides/late-payment-act-1998-explained">Late Payment of Commercial Debts (Interest) Act 1998</a>{" "}
            gives you interest at 8% over the Bank of England base rate, plus a fixed recovery cost per invoice.
            You don&rsquo;t need a clause in your deal memo. The right is automatic.
          </p>
          <div className={s.example}>
            <p className={s.exampleHead}>Example: a week&rsquo;s work, paid {EXAMPLE.days} days late</p>
            <table className={s.exampleTable}>
              <tbody>
                <tr><td>5 days at £350</td><td translate="no">{fmt(EXAMPLE.fee)}</td></tr>
                <tr><td>Kit hire, one week</td><td translate="no">{fmt(EXAMPLE.kit)}</td></tr>
                <tr><td>Statutory interest, {EXAMPLE.days} days at {pct(rate)} a year</td><td translate="no">+ {fmt(interest)}</td></tr>
                <tr><td>Fixed recovery cost</td><td translate="no">+ {fmt(fixed)}</td></tr>
                <tr><td>Now owed</td><td translate="no">{fmt(invoice + interest + fixed)}</td></tr>
              </tbody>
            </table>
            <p className={s.note}>
              The fixed cost is £40 on invoices under £1,000, £70 up to £9,999.99 and £100 above that.
              Put your own figures into the <a href="/calculator">late payment calculator</a>.
            </p>
          </div>
        </section>

        <section className={s.section}>
          <h2 className={s.h2}>What Hielda does, day by day</h2>
          <p className={s.p}>
            Create the invoice in Hielda, or add one that is already overdue. From there the schedule runs itself,
            and every email waits for your OK before it goes.
          </p>
          <div className={s.sheet}>
            <div className={s.sheetHead}><span>Chase schedule</span><span>Invoice to paid</span></div>
            <div className={s.sheetRow}>
              <div className={s.sheetWhen}>Before due</div>
              <p className={s.sheetWhat}><strong>Friendly reminders</strong> five days and one day before the due date, so it is in the payment run.</p>
            </div>
            <div className={s.sheetRow}>
              <div className={s.sheetWhen}>Day 1 overdue</div>
              <p className={s.sheetWhat}><strong>First chase.</strong> Interest and the fixed cost are now on the invoice, worked out to the day.</p>
            </div>
            <div className={s.sheetRow}>
              <div className={s.sheetWhen}>Days 7 to 30</div>
              <p className={s.sheetWhat}><strong>Escalating chases</strong> on days 7, 14, 21 and 30. The tone moves from polite to formal, and the total owed goes up in every email.</p>
            </div>
            <div className={s.sheetRow}>
              <div className={s.sheetWhen}>After 30 days</div>
              <p className={s.sheetWhat}><strong>A Letter Before Action</strong>, drafted from the invoice for you to send, then formal monthly reminders. It never goes quiet until you are paid.</p>
            </div>
          </div>
        </section>

        <section className={s.section}>
          <h2 className={s.h2}>Made for the way crew invoice</h2>
          <ul className={s.feats}>
            <li><strong>Day rates, overtime, kit and mileage</strong> on separate lines of one invoice.</li>
            <li><strong>PO and job numbers</strong> printed at the top, where accounts look for them.</li>
            <li><strong>Receipts attached</strong> to the invoice PDF for expenses and per diems.</li>
            <li><strong>Import a purchase order</strong> PDF and the lines fill themselves in.</li>
            <li><strong>Sent in your name</strong>, with you copied on everything.</li>
            <li><strong>Pause any time</strong>, for a production you want to handle yourself.</li>
          </ul>
        </section>

        <section className={s.section}>
          <h2 className={s.h2}>Who it works for</h2>
          <div className={s.split}>
            <div className={s.yes}>
              <h3 className={s.splitTitle}>Covered by the Act</h3>
              <ul className={s.splitList}>
                <li>Self-employed crew who invoice the production</li>
                <li>Crew working through their own limited company</li>
                <li>Kit, vehicle and facilities hire invoices</li>
                <li>Commercials, corporate, promos and dailies work</li>
              </ul>
            </div>
            <div className={s.no}>
              <h3 className={s.splitTitle}>Not covered</h3>
              <ul className={s.splitList}>
                <li>Crew paid through the production&rsquo;s payroll (PAYE). Late wages are an employment matter: speak to your union or Acas.</li>
                <li>Invoices your agent issues and collects for you.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={s.section}>
          <h2 className={s.h2}>Questions crew ask</h2>
          <div className={g.faqList}>
            {FILM_TV_FAQS.map(({ q, a }) => {
              const isOpen = openFaq === q
              return (
                <div key={q} className={g.faqItem}>
                  <button onClick={() => setOpenFaq(isOpen ? null : q)} className={g.faqBtn} aria-expanded={isOpen}>
                    <h3 className={g.faqQuestion}>{q}</h3>
                    <span className={g.faqToggle}>{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && <div className={g.faqAnswer}>{a}</div>}
                </div>
              )
            })}
          </div>
          <p className={s.note}>
            More detail: <a href="/guides/freelancer-rights-late-payment">your rights when a client pays late</a>,{" "}
            <a href="/guides/invoice-payment-terms-uk">payment terms</a> and{" "}
            <a href="/guides/letter-before-action">the Letter Before Action</a>.
          </p>
        </section>

        <div className={g.cta}>
          <div className={g.ctaTitle}>Get the invoice paid, and keep the relationship</div>
          <p className={g.ctaText}>
            Six weeks free, no card. One recovered late fee covers the first year.
          </p>
          <button onClick={start("bottom")} className={g.ctaBtn}>Start your free 6-week trial</button>
          <p className={g.ctaSmall}>£3.99 a month or £34.99 a year after the trial</p>
        </div>
      </div>
    </main>
  )
}
