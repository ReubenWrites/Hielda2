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

const REASONS = [
  ["“It’s with accounts.”", "It has been for three weeks. The payment run is always next Friday."],
  ["The office has closed.", "The people who booked you are on another job, and nobody is reading the production inbox."],
  ["You’d rather not be that person.", "So thirty days becomes sixty, and sixty becomes ninety."],
]

const STEPS = [
  ["Before it’s due", "Two short reminders, five days and one day ahead, so your invoice makes the payment run."],
  ["Day 1 overdue", "The first chase. Interest and the fixed fee go on, calculated to the day."],
  ["Days 7 to 30", "Four more, each firmer than the last, each stating the new total."],
  ["After 30 days", "A Letter Before Action, drafted from the invoice and ready for you to send. Then a formal reminder every month until you’re paid."],
]

const FEATURES = [
  ["Day rates, overtime, kit, mileage", "Each on its own line, all on one invoice."],
  ["PO and job numbers", "At the top of the invoice, where accounts look first."],
  ["Receipts", "Attached to the PDF, so expenses don’t get queried."],
  ["Purchase orders", "Import the PDF and the lines fill themselves in."],
  ["Your name on it", "Emails go out on your behalf, and you’re copied on every one."],
  ["Your call", "Pause the chasing on any invoice, whenever you like."],
]

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
    <main className={s.page}>
      <nav className={g.nav}>
        <a href="/" className={g.navLogo} onClick={go(onBack)} style={{ textDecoration: "none", color: "inherit" }}>
          <ShieldLogo size={28} />
          <span className={g.navLogoText}>Hielda</span>
        </a>
        <button onClick={start("nav")} className={g.navTrialBtn}>Start Free Trial</button>
      </nav>

      <header className={s.hero}>
        <p className={s.pill}>For film &amp; TV freelancers</p>
        <h1 className={s.h1}>
          If they pay you late,
          <span>they should pay you more.</span>
        </h1>
        <p className={s.lede}>
          Film and TV run on freelancers like you, yet the payments you live on are far too often late.
          The law is clear about what happens next. Hielda chases your invoices and adds the interest
          and late fees you&rsquo;re owed, professionally and within the law.
        </p>
        <div className={s.btns}>
          <button onClick={start("hero")} className={s.primary}>Start free trial</button>
          <a href="/calculator" className={s.secondary}>Work out what you&rsquo;re owed</a>
        </div>
        <p className={s.small}>Six weeks free · No card · Nothing sent without your approval</p>
      </header>

      <section className={s.proof} aria-label="Who uses Hielda">
        <p className={s.proofLabel}>Made by a working producer · Used or trialled by freelancers in</p>
        <p className={s.proofList}>
          {DEPARTMENTS.map((d, i) => <span key={d}>{i > 0 && <i aria-hidden="true">·</i>}{d}</span>)}
        </p>
      </section>

      <section className={s.band}>
        <div className={s.row}>
          <div>
            <p className={s.kicker}>The problem</p>
            <h2 className={s.h2}>Nobody decides not to pay you</h2>
          </div>
          <div>
            <p className={s.p}>
              The job wrapped weeks ago and the invoice is still unpaid. It is almost never a decision.
              The production office closes, the accountant starts another job, and your invoice sits in
              an inbox nobody opens.
            </p>
            <p className={s.p}>
              And you say nothing, because your next job comes from the same few people.
            </p>
            <ul className={s.lines}>
              {REASONS.map(([term, text]) => (
                <li key={term}>
                  <h3 className={s.linesTerm}>{term}</h3>
                  <p className={s.linesText}>{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={`${s.band} ${s.bandWhite}`}>
        <div className={s.row}>
          <div>
            <p className={s.kicker}>The law</p>
            <h2 className={s.h2}>What a late invoice is actually worth</h2>
          </div>
          <div>
            <p className={s.p}>
              If you invoice as a sole trader or through your own company, the{" "}
              <a href="/guides/late-payment-act-1998-explained">Late Payment Act</a> adds interest at 8% over
              the Bank of England base rate, plus a fixed fee of £40 to £100 on every invoice.
            </p>
            <p className={s.p}>
              It needs no clause in your deal memo. It applies from the first day the invoice is overdue.
            </p>
            <div className={s.invoice}>
              <div className={s.invHead}>
                <div>
                  <p className={s.invLabel}>Invoice</p>
                  <p className={s.invRef}>One week, second unit</p>
                </div>
                <span className={s.invBadge}>{EXAMPLE.days} days overdue</span>
              </div>
              <table className={s.invTable}>
                <tbody>
                  <tr><td>5 days at £350</td><td translate="no">{fmt(EXAMPLE.fee)}</td></tr>
                  <tr><td>Kit hire, one week</td><td translate="no">{fmt(EXAMPLE.kit)}</td></tr>
                  <tr className={s.added}><td>Statutory interest at {pct(rate)}</td><td translate="no">+ {fmt(interest)}</td></tr>
                  <tr className={s.added}><td>Fixed recovery fee</td><td translate="no">+ {fmt(fixed)}</td></tr>
                  <tr className={s.total}><td>Now owed</td><td translate="no">{fmt(invoice + interest + fixed)}</td></tr>
                </tbody>
              </table>
            </div>
            <p className={s.fine}>
              The fee is £40 on invoices under £1,000, £70 up to £9,999.99 and £100 above that.
              Try your own figures in the <a href="/calculator">calculator</a>.
            </p>
          </div>
        </div>
      </section>

      <section className={s.figures} aria-label="Key figures">
        <div className={s.figuresInner}>
          <div><p className={s.figNum} translate="no">{pct(rate)}</p><p className={s.figLabel}>Statutory interest a year</p></div>
          <div><p className={s.figNum} translate="no">£40–100</p><p className={s.figLabel}>Fixed fee per late invoice</p></div>
          <div><p className={s.figNum}>30 days</p><p className={s.figLabel}>Default terms if none agreed</p></div>
          <div><p className={s.figNum}>6 years</p><p className={s.figLabel}>To claim what you&rsquo;re owed</p></div>
        </div>
      </section>

      <section className={s.band}>
        <div className={s.row}>
          <div>
            <p className={s.kicker}>How it works</p>
            <h2 className={s.h2}>Hielda does the asking</h2>
          </div>
          <div>
            <p className={s.p}>
              Raise the invoice in Hielda, or add one that&rsquo;s already late. The rest runs to a schedule,
              and every email waits for your approval.
            </p>
            <ol className={s.steps}>
              {STEPS.map(([when, what]) => (
                <li key={when}>
                  <p className={s.stepWhen}>{when}</p>
                  <p className={s.stepWhat}>{what}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={`${s.band} ${s.bandWhite}`}>
        <div className={s.row}>
          <div>
            <p className={s.kicker}>The details</p>
            <h2 className={s.h2}>Built around how crew get paid</h2>
          </div>
          <ul className={`${s.lines} ${s.linesTight}`}>
            {FEATURES.map(([term, text]) => (
              <li key={term}>
                <h3 className={s.linesTerm}>{term}</h3>
                <p className={s.linesText}>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={s.band}>
        <div className={s.row}>
          <div>
            <p className={s.kicker}>Who it&rsquo;s for</p>
            <h2 className={s.h2}>If you invoice, you&rsquo;re covered</h2>
          </div>
          <div className={s.cover}>
            <div className={s.coverCol}>
              <h3 className={s.coverTitle}>Covered</h3>
              <ul className={s.coverList}>
                <li>You invoice the production as a sole trader.</li>
                <li>You work through your own limited company.</li>
                <li>You hire out kit, vehicles or facilities.</li>
                <li>Commercials, corporate, promos and dailies.</li>
              </ul>
            </div>
            <div className={s.coverCol}>
              <h3 className={s.coverTitle}>Not covered</h3>
              <ul className={s.coverList}>
                <li>You&rsquo;re paid through the production&rsquo;s payroll. Late wages are an employment matter, and your union or Acas is the right call.</li>
                <li>Your agent invoices and collects for you.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={`${s.band} ${s.bandWhite}`}>
        <div className={s.faqWrap}>
          <h2 className={`${s.h2} ${s.faqTitle}`}>Questions crew ask</h2>
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
          <p className={s.fine} style={{ maxWidth: "none", textAlign: "center" }}>
            More on <a href="/guides/freelancer-rights-late-payment">your rights</a>,{" "}
            <a href="/guides/invoice-payment-terms-uk">payment terms</a> and{" "}
            <a href="/guides/letter-before-action">the Letter Before Action</a>.
          </p>
        </div>
      </section>

      <div className={s.closing}>
        <div className={g.cta}>
          <div className={g.ctaTitle}>Get paid. Stay on good terms.</div>
          <p className={g.ctaText}>
            Six weeks free, no card. One recovered late fee pays for the year.
          </p>
          <button onClick={start("bottom")} className={g.ctaBtn}>Start free trial</button>
          <p className={g.ctaSmall}>£3.99 a month or £34.99 a year after the trial</p>
        </div>
      </div>
    </main>
  )
}
