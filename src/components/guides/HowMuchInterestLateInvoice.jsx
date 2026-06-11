import { getBoe, getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import s from "./guides.module.css"

const TITLE = "How much interest can you charge on a late invoice in the UK?"
const LEDE = "The short answer: 8% above the Bank of England base rate per year, accruing daily, on any overdue business-to-business invoice — plus a fixed sum of £40, £70, or £100 on top. Here's the exact formula, ready-made figures for common invoice sizes, and the rules on when it starts."
const CANONICAL = "/guides/how-much-interest-late-invoice"

const fmt = n => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Statutory interest on `amount` after `days` overdue, at the current rate
const int = (amount, days) => fmt(amount * (getRate() / 100) / 365 * days)

const FAQS = [
  {
    q: "Can I backdate interest on old invoices?",
    a: "Yes. The right is statutory and doesn't expire when an invoice is eventually paid late or forgotten — you can claim interest and the fixed sum on any qualifying B2B invoice going back up to six years (the limitation period in England and Wales; five years in Scotland). Some businesses run a 'late payment audit' on old ledgers and recover surprising sums.",
  },
  {
    q: "Do I have to warn the client first?",
    a: "No. The right applies automatically the moment a B2B invoice goes overdue — you don't need to have mentioned interest in your contract, on the invoice, or in any prior warning. That said, telling clients early (a line in your terms or invoice footer) is good practice: it deters late payment in the first place.",
  },
  {
    q: "Is the 8% per year or per month?",
    a: "Per year. Statutory interest is 8 percentage points above the Bank of England base rate, expressed per annum, and it accrues daily — so divide the annual figure by 365 to get the daily amount. It is not 8% per month, and it doesn't compound: it's simple interest on the outstanding sum.",
  },
  {
    q: "Can I charge interest if my contract doesn't mention it?",
    a: "For business clients, yes — the Late Payment of Commercial Debts (Interest) Act 1998 gives you the right whether or not your contract or invoice says anything about it. For consumer clients the position reverses: there's no statutory right, so you can only charge interest if your contract includes a term allowing it, at a reasonable rate.",
  },
  {
    q: "Does the client have to pay the interest?",
    a: "Legally, yes — once a B2B invoice is overdue, the interest and fixed sum are debts owed to you just as much as the invoice itself, and a court will award them. Practically, some clients pay the invoice and ignore the extras; you then choose whether the amounts justify pressing the point. Even when you ultimately waive them, claiming them changes behaviour — clients pay faster when the meter is visibly running.",
  },
  {
    q: "What can I charge a consumer (non-business) client?",
    a: "The Act doesn't apply to consumers, so you need a contractual term agreed before the work — and it must be a reasonable rate or it risks being unenforceable as a penalty. Many freelancers mirror the statutory approach (a few percent above base rate) for consumer contracts, which is hard to argue with.",
  },
]

export default function HowMuchInterestLateInvoice({ onBack, onGetStarted }) {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: TITLE,
        description: LEDE,
        url: `https://hielda.com${CANONICAL}`,
        mainEntityOfPage: `https://hielda.com${CANONICAL}`,
        author: { "@type": "Organization", name: "Hielda", url: "https://hielda.com" },
        publisher: { "@type": "Organization", name: "Hielda", url: "https://hielda.com" },
        inLanguage: "en-GB",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://hielda.com/" },
          { "@type": "ListItem", position: 2, name: "Guides", item: "https://hielda.com/guides" },
          { "@type": "ListItem", position: 3, name: TITLE, item: `https://hielda.com${CANONICAL}` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: typeof a === "string" ? a : "See guide for details." },
        })),
      },
    ],
  }

  return (
    <GuideLayout
      title={TITLE}
      lede={LEDE}
      canonicalPath={CANONICAL}
      onBack={onBack}
      onGetStarted={onGetStarted}
      faqs={FAQS}
      schema={schema}
      related={[
        { href: "/calculator", title: "Late payment interest calculator", desc: "Enter any overdue invoice and get the exact interest and fixed sum, calculated at today's rate." },
        { href: "/guides/late-payment-act-1998-explained", title: "The Late Payment Act 1998 — explained", desc: "The statute behind the 8% — who it covers, when it applies, and the common myths." },
        { href: "/guides/how-to-chase-late-invoices", title: "How to chase late invoices professionally", desc: "The day-by-day playbook for actually collecting what you're owed." },
      ]}
    >
      <h2>The headline answer</h2>
      <p>
        For business-to-business invoices, UK law lets you charge <strong>statutory interest at 8% above the Bank of England base rate</strong>. With the base rate currently at {getBoe()}%, that's <strong>{getRate()}% per annum</strong>, accruing daily from the day after the invoice's due date until it's paid. The right comes from the Late Payment of Commercial Debts (Interest) Act 1998 and applies automatically — no contract clause, no invoice small print, no advance warning required.
      </p>
      <p>
        On top of the interest, the Act adds a <strong>fixed debt recovery sum</strong> per overdue invoice, and you can claim both together. More on that below.
      </p>

      <h2>The exact formula</h2>
      <p>
        Statutory interest is simple (non-compounding) interest, calculated daily:
      </p>
      <div className={s.calloutGrey}>
        <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: "#1e293b" }}>
          <strong>interest owed = invoice amount × {getRate()}% ÷ 365 × days overdue</strong>
        </p>
      </div>
      <p>Worked through step by step for a £2,000 invoice that's 45 days overdue:</p>
      <ol>
        <li><strong>Annual interest:</strong> £2,000 × {getRate()}% = £{fmt(2000 * getRate() / 100)} per year</li>
        <li><strong>Daily interest:</strong> £{fmt(2000 * getRate() / 100)} ÷ 365 = £{fmt(2000 * getRate() / 100 / 365)} per day</li>
        <li><strong>Total at 45 days:</strong> 45 × the daily rate = <strong>£{int(2000, 45)}</strong></li>
      </ol>
      <p>
        Not life-changing on its own — but it accrues every single day the client delays, and it sits on top of the fixed sum below. Together they comfortably cover the cost of chasing, which is exactly what Parliament intended.
      </p>

      <h2>The fixed sums on top</h2>
      <p>
        Separately from interest, every overdue B2B invoice entitles you to a one-off <strong>fixed sum for debt recovery costs</strong>, banded by invoice value:
      </p>
      <ul>
        <li>Debt under £1,000 — <strong>£40</strong></li>
        <li>Debt of £1,000 to £9,999.99 — <strong>£70</strong></li>
        <li>Debt of £10,000 or more — <strong>£100</strong></li>
      </ul>
      <p>
        It's claimable the moment the invoice goes overdue, in full, regardless of how late payment ends up being — and it applies per invoice, so three late invoices from the same client means three fixed sums.
      </p>

      <h2>Ready-made figures for common invoice sizes</h2>
      <p>
        The table below shows statutory interest alone (the fixed sum comes on top) at the current rate of {getRate()}%. The figures move whenever the Bank of England changes the base rate, so for an invoice you're chasing right now, use the <a href="/calculator">live calculator</a>.
      </p>
      <div className={s.workedExample}>
        <h3>Interest owed at {getRate()}% p.a.</h3>
        <table>
          <tbody>
            <tr><td><strong>Invoice</strong></td><td><strong>30 days</strong></td><td><strong>60 days</strong></td><td><strong>90 days late</strong></td></tr>
            <tr><td>£500</td><td>£{int(500, 30)}</td><td>£{int(500, 60)}</td><td>£{int(500, 90)}</td></tr>
            <tr><td>£1,000</td><td>£{int(1000, 30)}</td><td>£{int(1000, 60)}</td><td>£{int(1000, 90)}</td></tr>
            <tr><td>£2,500</td><td>£{int(2500, 30)}</td><td>£{int(2500, 60)}</td><td>£{int(2500, 90)}</td></tr>
            <tr><td>£5,000</td><td>£{int(5000, 30)}</td><td>£{int(5000, 60)}</td><td>£{int(5000, 90)}</td></tr>
            <tr><td>£10,000</td><td>£{int(10000, 30)}</td><td>£{int(10000, 60)}</td><td>£{int(10000, 90)}</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Add the fixed sum (£40 / £70 / £100) to any of these for the total claimable. A £5,000 invoice 90 days late is £{int(5000, 90)} interest + £70 fixed sum = £{fmt(5000 * (getRate() / 100) / 365 * 90 + 70)} on top of the invoice.
        </p>
      </div>

      <h2>B2B only — consumer clients are different</h2>
      <p>
        The Act covers <strong>commercial debts only</strong>: both you and the client must be acting in the course of a business. Limited companies, sole traders, partnerships, and public bodies all count. Private individuals don't. If your client is a consumer, there's no statutory right — you can only charge interest if your contract includes a term allowing it, and courts will only enforce a <em>reasonable</em> rate. Excessive contractual rates risk being struck down as penalties.
      </p>

      <h2>Contractual interest vs statutory interest</h2>
      <p>
        If your B2B contract specifies its own late payment interest rate, that rate generally applies <em>instead of</em> the statutory rate — but only if it provides a "substantial remedy". A contract clause that sets interest at a token level (say, 1% a year) doesn't oust the Act; the statutory rate steps back in. In practice: if your contract is silent, you get {getRate()}%; if it names a meaningful rate, you get that rate.
      </p>

      <h2>When the clock starts</h2>
      <p>
        Interest runs from <strong>the day after the due date</strong>:
      </p>
      <ul>
        <li>If your contract or invoice sets payment terms (7 days, 14 days, 30 days net), the clock starts the day after that period expires.</li>
        <li>If nothing was agreed, the Act's default applies: payment is due <strong>30 days</strong> after delivery of the goods, performance of the services, or receipt of the invoice — whichever is latest — and interest starts the day after that.</li>
      </ul>

      <h2>A note on VAT</h2>
      <p>
        Statutory interest is calculated on the <strong>gross, VAT-inclusive</strong> amount of the unpaid invoice — the whole debt is overdue, including the VAT element. The interest you receive is itself outside the scope of VAT, so you don't charge VAT on it or issue a VAT invoice for it.
      </p>

      <h2>How to actually claim it</h2>
      <p>
        The mechanics are simple: state the figures and keep them updated. Add a line to your chase emails — <em>"this invoice is now accruing statutory interest at {getRate()}% per annum under the Late Payment of Commercial Debts (Interest) Act 1998, plus a £70 fixed debt recovery cost"</em> — and show the running total on any statement or formal letter. The <a href="/calculator">calculator</a> gives you exact figures to paste in, and our <a href="/guides/how-to-chase-late-invoices">chasing playbook</a> covers when in the sequence to introduce them.
      </p>
      <p>
        The honest friction is the upkeep: the total changes daily, every chase needs re-calculating, and most freelancers find invoking the law against their own client awkward. That's the part Hielda removes — it tracks every invoice's due date, calculates interest daily at the live rate, applies the correct fixed sum, and sends the escalating chases on your behalf, so the statutory charges are claimed consistently without you drafting a single email.
      </p>

      <h2>Bottom line</h2>
      <p>
        On any overdue B2B invoice you can charge {getRate()}% a year, counted daily, plus £40–£100 fixed — automatically, retrospectively up to six years, with no contract term needed. The amounts are modest per invoice, but the effect on behaviour isn't: clients who see the meter running pay first.
      </p>
    </GuideLayout>
  )
}
