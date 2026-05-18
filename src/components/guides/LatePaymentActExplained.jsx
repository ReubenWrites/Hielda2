import { getBoe, getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import s from "./guides.module.css"

const TITLE = "Late Payment of Commercial Debts (Interest) Act 1998 — explained for freelancers and SMEs"
const LEDE = "A plain-English guide to the UK statute that gives every business the right to charge interest and a fixed debt recovery cost on overdue B2B invoices — automatically, even if your contract is silent on it."
const CANONICAL = "/guides/late-payment-act-1998-explained"

const FAQS = [
  {
    q: "Do I need to mention the Act on my invoice for it to apply?",
    a: "No. The right is statutory — it applies to qualifying B2B transactions automatically. You can claim interest and the fixed sum retrospectively on any overdue commercial invoice, even if neither the original invoice nor your contract mentioned them.",
  },
  {
    q: "What's the current statutory interest rate?",
    a: <>The rate is set at 8% above the Bank of England base rate (BoE base rate is currently <strong>{getBoe()}%</strong>, so the statutory rate is <strong>{getRate()}% per annum</strong>). Interest accrues daily on the unpaid sum from the day after the contractual or statutory due date until the debt is paid in full.</>,
  },
  {
    q: "Does the Act apply to invoices to individuals or consumers?",
    a: "No. The Act covers business-to-business commercial debts only — both parties must be acting in the course of a business. For consumer invoices you have to rely on what's set out in your contract (often contractual interest at a reasonable rate). Hielda lets you toggle 'Consumer' on a per-invoice basis and adjusts the wording accordingly.",
  },
  {
    q: "Can I recover legal or collection costs above the fixed sum?",
    a: "Yes. Section 5A(2A) (inserted by the 2013 amendment) gives you the right to claim 'reasonable costs' of recovering the debt that exceed the fixed sum — for example, debt collection agency fees or solicitor's letters before action. The fixed sum is a floor, not a ceiling.",
  },
  {
    q: "What if my contract specifies a different payment period?",
    a: "Up to a point, that's fine — the parties can agree any payment terms in writing. But under section 4(2)(a) the agreed period can't be 'grossly unfair'. Anything beyond 60 days for a B2B contract is presumed unfair unless expressly agreed and objectively justified.",
  },
  {
    q: "When does the right to interest start exactly?",
    a: "From the day after the agreed payment due date. If no due date was agreed, the default is 30 days from delivery of goods, performance of services, or receipt of the invoice — whichever is latest. From that point interest accrues daily.",
  },
  {
    q: "Will charging interest damage the client relationship?",
    a: "It can if you raise it personally and confrontationally — which is precisely why most freelancers don't. The Act exists to be used. Tools like Hielda send the formal notices on your behalf so the awkward conversation happens between your client and 'the accounts team', not between you and your client.",
  },
]

export default function LatePaymentActExplained({ onBack, onGetStarted }) {
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
        { href: "/calculator", title: "Late payment interest calculator", desc: "Plug in any overdue invoice — see exactly what you're owed under the Act." },
        { href: "/late-payment-letter-template", title: "Free demand letter template", desc: "Professionally-worded letter you can send to any UK client, citing the Act." },
        { href: "/guides/how-to-chase-late-invoices", title: "How to chase late invoices professionally", desc: "A practical day-by-day playbook for freelancers and SMEs." },
      ]}
    >
      <h2>What the Act does, in one paragraph</h2>
      <p>
        The <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong> gives every business in the UK an automatic right to charge statutory interest and a fixed debt recovery cost on any business-to-business invoice that's paid late. You don't need to have mentioned it in your contract. You don't need to have mentioned it on your invoice. The right applies the moment the payment period expires — whether that period was contractually agreed or set by the Act's default of 30 days.
      </p>
      <p>
        The Act has been amended twice (in 2002 and 2013) to bring UK law in line with successive EU Late Payment Directives, but its core protection has stayed the same: late payers should compensate suppliers for both the time value of money and the cost of chasing.
      </p>

      <h2>Who does it cover?</h2>
      <p>
        The Act covers "commercial debts" — money owed under a contract for the supply of goods or services between two parties acting in the course of a business. In practice that means:
      </p>
      <ul>
        <li><strong>Freelancers and contractors</strong> billing a business client (whether a limited company, partnership, or another sole trader)</li>
        <li><strong>Limited companies</strong> and <strong>sole traders</strong> billing each other</li>
        <li><strong>Public-sector contracts</strong> — central and local government bodies are explicitly within scope</li>
      </ul>
      <p>
        It does <em>not</em> cover invoices to consumers (individuals not acting in the course of a business). For consumer invoices you rely on your contractual terms — typically a stated interest rate and recovery costs agreed in writing.
      </p>

      <h2>What you're entitled to claim</h2>
      <p>There are three components, and you can claim all of them on the same invoice:</p>

      <h3>1. Statutory interest</h3>
      <p>
        Interest at <strong>8% above the Bank of England base rate</strong>, calculated on a per-annum basis, accruing daily from the day after the payment due date. With the BoE base rate currently at {getBoe()}%, the statutory rate is <strong>{getRate()}%</strong>.
      </p>
      <p>
        The formula: <code>invoice amount × {getRate()}% ÷ 365 × days overdue</code>.
      </p>

      <h3>2. Fixed sum for debt recovery costs</h3>
      <p>
        A fixed sum per overdue invoice, regardless of how long it's overdue:
      </p>
      <ul>
        <li>Invoices under £1,000 — <strong>£40</strong></li>
        <li>Invoices £1,000 to £9,999.99 — <strong>£70</strong></li>
        <li>Invoices £10,000 or more — <strong>£100</strong></li>
      </ul>
      <p>
        The Act refers to this as the "fixed sum (debt recovery cost)" — not a "penalty" or "fine". The wording matters if a client pushes back: it's not punitive, it's statutorily fixed compensation for the cost of recovering the debt.
      </p>

      <h3>3. Additional reasonable costs (s.5A(2A))</h3>
      <p>
        Inserted by the 2013 amendment, this gives you the right to claim any further <em>reasonable</em> costs of recovering the debt — debt collection agency fees, solicitor's letters before action, court fees — to the extent they exceed the fixed sum. You'd typically only claim this if the debt actually escalates to a third party.
      </p>

      <div className={s.workedExample}>
        <h3>Worked example: £3,000 invoice, 30 days late</h3>
        <table>
          <tbody>
            <tr><td>Original invoice</td><td>£3,000.00</td></tr>
            <tr><td>Fixed debt recovery cost (£1,000–£9,999.99 tier)</td><td>+ £70.00</td></tr>
            <tr><td>Interest (30 days at {getRate()}% p.a.)</td><td>+ £28.97</td></tr>
            <tr><td><strong>Total now owed</strong></td><td>£3,098.97</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Plug your own numbers into the <a href="/calculator">free calculator</a>.
        </p>
      </div>

      <h2>When the right starts</h2>
      <p>
        Interest and the fixed sum become claimable from the day after the payment due date. The due date is whichever of these applies:
      </p>
      <ol>
        <li><strong>The date agreed in the contract</strong> — provided it's not "grossly unfair" (anything more than 60 days for B2B is presumed unfair unless expressly justified)</li>
        <li><strong>30 days from delivery / performance / invoice</strong> — the statutory default if no payment period was agreed, whichever is latest</li>
      </ol>
      <p>
        Once the due date passes, interest starts accruing daily and the fixed sum becomes claimable in one go. You do not need to send any formal notice to "activate" the right — it's automatic.
      </p>

      <h2>Common myths and misconceptions</h2>

      <h3>"I can only charge interest if it's in my contract"</h3>
      <p>
        False. The statutory right exists independently of your contract. You can be entirely silent in your contract and on your invoice, and still claim interest on every overdue B2B invoice.
      </p>

      <h3>"I can only charge if the client agreed to it"</h3>
      <p>
        False. The Act gives you the right by statute. Your client doesn't need to have agreed — they only need to be a business that's paid you late.
      </p>

      <h3>"It's a £40 penalty for late payment"</h3>
      <p>
        Imprecise. The fixed sum varies by invoice value (£40 / £70 / £100) and the Act calls it a "fixed sum for debt recovery costs", not a penalty. Calling it a penalty can put clients on the defensive; the statutory language is more measured and harder to argue with.
      </p>

      <h3>"It'll cost more to claim than I'll get back"</h3>
      <p>
        Usually false. The fixed sum alone covers most of the time a freelancer would spend chasing. Interest on top adds up faster than most people realise — a £5,000 invoice 60 days late is around <strong>£96</strong> in interest at the current rate, on top of the £70 fixed sum. And with an automated tool like Hielda, your time cost is zero.
      </p>

      <h2>How to actually use the Act</h2>
      <p>You have three practical options, in increasing order of effort and effectiveness:</p>

      <h3>Option 1: Mention it in chase emails</h3>
      <p>
        The simplest thing is to reference the Act in your chase emails. A line like <em>"under the Late Payment of Commercial Debts (Interest) Act 1998, this invoice is now accruing statutory interest at {getRate()}% per annum plus a fixed debt recovery cost of £70"</em> changes the conversation. Most accounts departments recognise the Act and process the invoice rather than argue.
      </p>

      <h3>Option 2: Send a formal demand letter</h3>
      <p>
        For invoices that stay unpaid past gentle reminders, a formal demand letter — citing the Act and stating exact amounts owed — is the standard pre-action step before escalating to County Court or a debt recovery agency. We have a <a href="/late-payment-letter-template">free template</a> you can copy and edit.
      </p>

      <h3>Option 3: Use a tool that does it for you</h3>
      <p>
        The friction in claiming under the Act is rarely the law — it's the writing, the calculating, the awkwardness, and the follow-through. <a onClick={onGetStarted} style={{ cursor: "pointer" }}>Hielda</a> automates the whole sequence: tracking due dates, sending escalating chase emails, calculating daily interest, citing the Act, and applying the fixed sum. You stay out of the conversation entirely.
      </p>

      <h2>Limitations and edge cases</h2>
      <ul>
        <li><strong>Six-year limit.</strong> Like most contract claims, you have six years from the breach (i.e. the missed payment) to bring a claim.</li>
        <li><strong>"Grossly unfair" contract terms.</strong> Contracts can specify payment periods longer than 30 days, but anything excessive may be unenforceable. A 90- or 120-day net term for a £200 invoice probably won't stand up if challenged.</li>
        <li><strong>Disputed invoices.</strong> If a client has a bona fide dispute about the goods or services delivered, interest doesn't accrue on the disputed portion until the dispute is resolved. (You should still issue the invoice and document the dispute.)</li>
        <li><strong>Partial payments.</strong> Interest is calculated on the outstanding balance, so partial payments reduce the accruing interest from that date forward.</li>
      </ul>

      <h2>Bottom line</h2>
      <p>
        The Late Payment Act is one of the strongest pro-supplier protections in UK law, but it's chronically under-used because most freelancers and small businesses don't know it exists or feel uncomfortable invoking it. You're leaving money on the table if you're not claiming under it on every overdue B2B invoice. The amounts are modest per invoice but they add up — and far more importantly, they shift the dynamic. A client who knows the meter is running pays faster than one who doesn't.
      </p>
    </GuideLayout>
  )
}
