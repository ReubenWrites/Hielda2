import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import CompareTable from "./CompareTable"
import { comparisonSchema, HIELDA_PRICE, HIELDA_TRIAL } from "./comparisonSchema"
import s from "./guides.module.css"

const TITLE = "Hielda vs a debt collection agency: cost, powers and when each makes sense"
const LEDE = "A debt collection agency takes a slice of what it recovers and gets involved when a relationship is already over. Hielda chases from the day the invoice is late, adds the statutory charges, and costs a flat few pounds a month. They are not rivals so much as different stages. Here is how they compare."
const CANONICAL = "/guides/hielda-vs-debt-collection-agency"

const FAQS = [
  { q: "How much does a debt collection agency take?", a: "Most UK commercial agencies work no-win-no-fee on commission, typically 8% to 20% of what they recover, with higher rates for old or small debts and some charging minimum or instruction fees. On a £2,000 invoice at 15% that is £300. Hielda is £3.99 a month regardless of invoice size, and takes nothing from what is recovered." },
  { q: "Does a debt collection agency have legal powers Hielda doesn't?", a: "No. An agency can write, email and phone, which is exactly what you or Hielda can do. Neither can seize goods or enter premises; that needs a County Court Judgment and enforcement officers. An agency's leverage is persistence and the psychological effect of a third party; Hielda's is the same third-party effect plus the statutory interest and fixed costs growing on every chase." },
  { q: "Can I use Hielda and then an agency?", a: "Yes, and that is often the right order. Hielda runs the professional chase sequence and Letter Before Action over the first 30 to 60 days, which recovers most invoices. If a client still won't pay, you have a documented trail of chases and a formal letter, which makes the agency's or the court's job easier." },
  { q: "Will an agency damage the client relationship?", a: "Usually. A third-party collector's letter signals the commercial relationship is finished and most clients treat it that way. Hielda's early chases are polite reminders sent in your name, and only unpaid invoices escalate, so a client who simply forgot gets a nudge rather than a collector." },
  { q: "What about invoices under £1,000?", a: "Agencies often set minimum debt values or minimum fees, and a 15% commission on £400 is £60 of their time, so small debts get little attention. Hielda's cost is the same for a £300 invoice as a £30,000 one, and the Act's £40 fixed recovery cost alone covers nearly a year of the subscription." },
]

export default function HieldaVsDebtCollectionAgency({ onBack, onGetStarted }) {
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
        { href: "/guides/debt-collection-agency-vs-diy", title: "Debt collection agency, DIY, or automation?", desc: "The full decision guide by how late the invoice is." },
        { href: "/guides/letter-before-action", title: "Letter Before Action", desc: "The formal step that gets most stubborn invoices paid." },
        { href: "/guides/small-claims-court-unpaid-invoice", title: "Small claims court for unpaid invoices", desc: "What Money Claim Online costs and when it's worth it." },
      ]}
    >
      <h2>The short version</h2>
      <p>
        An agency is a late-stage option you pay for with a percentage. Hielda is an early-stage option you pay for with a subscription. Use Hielda from the day an invoice is issued and you will rarely need the agency; use the agency only for the invoice that survives a month of professional chasing and a Letter Before Action.
      </p>

      <h2>Hielda vs a debt collection agency at a glance</h2>
      <CompareTable
        colA="Hielda"
        colB="Debt collection agency"
        rows={[
          { label: "Cost", a: `${HIELDA_PRICE}, any number of invoices`, b: "Typically 8% to 20% of what is recovered; some minimum or instruction fees" },
          { label: "Cost on a £2,000 invoice recovered", a: "£3.99 (one month)", b: "Around £160 to £400" },
          { label: "When it gets involved", a: "Five days before the due date", b: "Usually 60 to 120 days overdue, when you give up" },
          { label: "Statutory interest and fixed recovery cost added", a: "Yes, daily, on every chase", b: "Sometimes claimed; often absorbed into the commission" },
          { label: "Legal powers", b: "None beyond writing, emailing and phoning", a: "None beyond writing and emailing, the same as you" },
          { label: "Letter Before Action", a: "Drafted from the invoice at day 30", b: "Often offered, sometimes as an extra" },
          { label: "Sent in whose name", a: "Yours, with Hielda's branding on formal notices", b: "The agency's" },
          { label: "Effect on the client relationship", a: "Polite early, firm later; forgetful clients get a reminder", b: "Signals the relationship is over" },
          { label: "Minimum invoice size", a: "None", b: "Often £100 to £500; small debts get less attention" },
          { label: "Control", a: "You confirm every email; pause, dispute or stop any time", b: "You hand it over" },
        ]}
      />

      <h2>Where the money goes</h2>
      <p>
        Take a £2,000 invoice paid 45 days late. Under the Late Payment of Commercial Debts (Interest) Act 1998 it has earned statutory interest at {getRate()}% a year, roughly £29 over those 45 days, plus the £70 fixed recovery cost: about <strong>£99 on top of the invoice</strong>, yours by right.
      </p>
      <ul>
        <li><strong>With Hielda</strong>, each chase has stated the growing total, so the client is asked for £2,099 and the subscription for that month cost £3.99.</li>
        <li><strong>With an agency at 15%</strong>, you receive the £2,000 less £300 commission. Some agencies will claim the statutory charges for you; many simply recover the face value and keep their percentage.</li>
      </ul>
      <p>
        That is the structural difference. The Act was written to make late payment cost the payer, not the supplier. A commission model moves that cost back to you.
      </p>

      <h2>What an agency does that Hielda doesn't</h2>
      <p>
        Honesty cuts both ways. A good agency brings <strong>people</strong>: someone who will phone the client's accounts department, negotiate an instalment plan, and chase a debtor who has stopped reading email. Hielda is automated and email-based; it cannot ring anyone. An agency may also handle tracing a debtor who has moved, and some offer doorstep visits, though a visit carries no power of entry or seizure without a court judgment.
      </p>
      <p>
        If an invoice is six months old, the client has gone quiet, and you have no documented chase history, an agency's persistence may be worth the percentage. The point of chasing properly from day one is to make that situation rare.
      </p>

      <h2>How to decide</h2>
      <div className={s.callout}>
        <p><strong>Invoice not yet due, or less than 60 days late:</strong> Hielda. Professional, consistent chasing with the statutory charges attached recovers the large majority of invoices at this stage, for a flat fee.</p>
        <p><strong>Invoice has survived a full chase sequence and a Letter Before Action:</strong> decide between <a href="/guides/small-claims-court-unpaid-invoice">Money Claim Online</a>, from £35 and an hour of your time, and an agency. Hielda sets out the options at that point and the chase history goes with you either way.</p>
      </div>
    </GuideLayout>
  )
}
