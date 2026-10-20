import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import CompareTable from "./CompareTable"
import { comparisonSchema, HIELDA_PRICE, HIELDA_TRIAL } from "./comparisonSchema"
import s from "./guides.module.css"

const TITLE = "Hielda vs Chaser: which invoice chasing tool fits a freelancer or small business?"
const LEDE = "Chaser is credit-control software built for finance teams. Hielda is late payment enforcement built for one person with a handful of overdue invoices. They solve different problems at very different prices. Here is an honest comparison."
const CANONICAL = "/guides/hielda-vs-chaser"

const FAQS = [
  { q: "How much does Chaser cost?", a: "At the time of writing (October 2026) Chaser's pricing page lists its entry plan, Compact, at £199 a month for businesses with turnover up to £4 million, with higher tiers at £599 and £899 a month and some features, such as SMS and the payment portal, as paid add-ons. Hielda is £3.99 a month or £34.99 a year." },
  { q: "Is Hielda a cheaper version of Chaser?", a: "No. They overlap on sending automated reminders but are built for different users. Chaser is a credit-control workspace for finance teams managing many customers and users, with accounting integrations and reporting. Hielda is for a freelancer or very small business that wants overdue invoices chased and the statutory interest and fixed costs under the Late Payment Act applied without doing it themselves." },
  { q: "Does Hielda integrate with Xero or QuickBooks?", a: "Not yet. Hielda creates and tracks invoices itself and sends the PDF to your client. If your business lives inside an accounting package with many invoices a month and several people involved, Chaser or your package's own reminders may suit you better." },
  { q: "Who should choose Chaser?", a: "A business with a finance function, dozens or hundreds of invoices a month, and a need for shared workflows, escalation across team members, reporting and accounting-system sync. At £199 a month and up, that is who the product and the price are designed for." },
  { q: "Who should choose Hielda?", a: "A freelancer, contractor or small company with a few invoices a month who wants late payers chased professionally and the money the law allows, interest and the fixed recovery cost, added to every chase automatically, for the price of a coffee a month." },
]

export default function HieldaVsChaser({ onBack, onGetStarted }) {
  const schema = comparisonSchema({ title: TITLE, lede: LEDE, canonical: CANONICAL, faqs: FAQS })
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
        { href: "/guides/hielda-vs-xero-invoice-reminders", title: "Hielda vs accounting software reminders", desc: "What Xero, QuickBooks and FreeAgent reminders do, and what they leave out." },
        { href: "/guides/hielda-vs-debt-collection-agency", title: "Hielda vs a debt collection agency", desc: "Commission, powers and timing compared." },
        { href: "/guides/how-to-chase-late-invoices", title: "How to chase late invoices", desc: "The day-by-day sequence Hielda automates." },
      ]}
    >
      <h2>The short version</h2>
      <p>
        If you have a finance team, Chaser. If you are the finance team, and the whole department is you on a Sunday evening, Hielda. Price is the first clue: Chaser starts at <strong>£199 a month</strong> for businesses turning over up to £4 million; Hielda is <strong>{HIELDA_PRICE}</strong>. Neither number is wrong. They are aimed at different businesses.
      </p>

      <h2>Hielda vs Chaser at a glance</h2>
      <CompareTable
        colA="Hielda"
        colB="Chaser"
        rows={[
          { label: "Built for", a: "Freelancers, contractors, micro-businesses", b: "Finance and credit-control teams" },
          { label: "Price", a: HIELDA_PRICE, b: "From £199/month (Compact, to £4m turnover); £599 and £899 tiers" },
          { label: "Free trial", a: HIELDA_TRIAL, b: "Free trial offered" },
          { label: "Users included", a: "One account", b: "Four on the entry plan, more on higher tiers" },
          { label: "Automated reminders and chases", a: true, b: true },
          { label: "Statutory interest and fixed recovery cost added to every chase, calculated daily", a: true, b: "Not its focus; check current features" },
          { label: "Letter Before Action drafted from the invoice", a: true, b: "Not its focus; check current features" },
          { label: "Accounting software integration (Xero, QuickBooks, Sage)", a: false, b: true },
          { label: "Shared workflows, team escalation, reporting", a: false, b: true },
          { label: "You approve every email to a client", a: true, b: "Configurable" },
          { label: "Creates the invoice and PDF for you", a: true, b: "Syncs from your accounting system" },
        ]}
      />
      <p className={s.calloutGrey}>
        Chaser's features and prices are taken from its public pricing page in October 2026 and will change. Where we are not certain what Chaser does, the table says so rather than guessing. Check their site before deciding.
      </p>

      <h2>What Chaser is good at</h2>
      <p>
        Chaser grew up inside accounting firms and finance departments. Its strength is <strong>volume and coordination</strong>: it pulls invoices from Xero, QuickBooks or Sage, lets several people share the chasing workload, records every call and email against the customer, and reports on who owes what and how the debtor book is ageing. If you send a hundred invoices a month and two colleagues chase them, that is exactly the tool you want, and the price reflects the size of business that needs it.
      </p>

      <h2>What Hielda is good at</h2>
      <p>
        Hielda starts from a different question: not "how do we run credit control?" but "<strong>what is this one late invoice actually owed, and who is going to ask for it?</strong>" Under the Late Payment of Commercial Debts (Interest) Act 1998, every overdue B2B invoice earns statutory interest at {getRate()}% a year plus a fixed recovery cost of £40, £70 or £100. Most freelancers never claim either, because working it out and asking for it feels awkward.
      </p>
      <ul>
        <li><strong>Every chase states the real total</strong>, with interest and the fixed cost calculated to the day. The number grows while the client delays, which is the point.</li>
        <li><strong>A fixed ladder</strong>: reminders five days and one day before the due date, a final warning on the day, then chases on days 1, 7, 14, 21 and 30, then formal monthly reminders. Weight rather than frequency.</li>
        <li><strong>A Letter Before Action drafted from the invoice</strong> at day 30, the step a court expects before a claim.</li>
        <li><strong>Nothing goes to a client without your say-so.</strong> Hielda checks whether you have been paid before each step and you confirm every send.</li>
        <li><strong>Part payments, disputes and pauses</strong> are handled: interest runs on the balance, a disputed invoice stops chasing and tells the client so.</li>
      </ul>
      <p>
        What Hielda does not do is run a team. There is one login, no accounting sync yet, and no reporting beyond your own invoices. For a sole trader that is the whole job; for a finance department it would be a toy.
      </p>

      <h2>How to decide</h2>
      <div className={s.callout}>
        <p><strong>Choose Chaser</strong> if invoices live in your accounting system, more than one person chases them, and you need reporting and an audit trail across a customer book. Budget from £199 a month.</p>
        <p><strong>Choose Hielda</strong> if you are chasing your own invoices, want the statutory charges applied without thinking about them, and would rather spend £3.99 a month than an evening a week. Start with the <a href="/calculator">calculator</a> to see what your current late invoice is owed.</p>
      </div>
    </GuideLayout>
  )
}
