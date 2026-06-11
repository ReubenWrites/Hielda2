import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import s from "./guides.module.css"

const TITLE = "Taking an unpaid invoice to small claims court — is it worth it?"
const LEDE = "If a client has ignored every chase and a formal Letter Before Action, the small claims court is the standard next step — and for clear-cut invoice debts it's cheaper, faster, and more DIY-friendly than most freelancers expect. Here's an honest look at when it's worth it, what it costs, and exactly how Money Claim Online works."
const CANONICAL = "/guides/small-claims-court-unpaid-invoice"

const fmt = n => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const FAQS = [
  {
    q: "How much does small claims court cost UK?",
    a: "The issue fee scales with the amount claimed: £35 for claims up to £300, rising through bands (£50, £70, £80, £115, £205) to £455 for claims of £5,000.01 to £10,000. If the case actually reaches a hearing there's a further hearing fee of £27 to £346 depending on claim size — but most invoice claims end in default judgment or settlement long before that. Both fees are added to your claim, so if you win, the debtor pays them. Check gov.uk for the current figures before filing, as fees are revised periodically.",
  },
  {
    q: "Do I need a solicitor for small claims?",
    a: "No. The small claims track is explicitly designed for people representing themselves — the forms are plain-English, hearings are informal, and the judge expects unrepresented parties. In fact, legal costs are generally not recoverable on the small claims track, so paying a solicitor usually doesn't make financial sense for a straightforward invoice debt under £10,000.",
  },
  {
    q: "How long does MCOL take?",
    a: "Filing the claim itself takes under an hour online. The defendant then has 14 days to respond (extendable to 28 if they acknowledge the claim). If they ignore it, you can request default judgment immediately after the deadline — so a completely undefended claim can produce a County Court judgment in roughly three to five weeks. If the claim is defended and goes to a hearing, expect several months.",
  },
  {
    q: "What if they defend the claim?",
    a: "Both sides complete a directions questionnaire, the court usually offers free telephone mediation, and if that fails the case is allocated to the small claims track and listed for a short, informal hearing. You'll need your contract or written agreement, the invoice, proof of delivery of the work, and your chase correspondence. If the work genuinely is disputed, be honest with yourself about the strength of your paper trail before filing — a weak claim that gets defended costs you time even when fees are modest.",
  },
  {
    q: "Can I claim court fees back?",
    a: "Yes. The issue fee (and hearing fee, if one is paid) is added to the amount you're claiming, and if you win — including by default judgment — the judgment is for the debt plus interest plus your court fees. You can also claim the fixed debt recovery sum and statutory interest under the Late Payment Act on top of the invoice itself.",
  },
  {
    q: "What if I win but they still don't pay?",
    a: "A judgment is an order, not a bank transfer. If the debtor still doesn't pay, you apply separately to enforce it — most commonly a warrant of control (court bailiffs), an attachment of earnings order against an individual's salary, or a third-party debt order freezing money in their bank account. Each has its own fee, also recoverable. Enforcement works well against solvent debtors with assets; it cannot conjure money from a company with nothing in it.",
  },
  {
    q: "Does a county court judgment affect the client's credit rating?",
    a: "Yes — and this is often why the mere threat works. An unpaid CCJ is registered against the company or individual for six years and makes borrowing, leasing, and trade credit significantly harder. If the debtor pays within one month of the judgment, it's removed from the register, which gives them a strong incentive to settle quickly once judgment is entered.",
  },
]

export default function SmallClaimsCourtUnpaidInvoice({ onBack, onGetStarted }) {
  // Worked-example figures, computed live so they track the current statutory rate
  const exInterest = 3200 * (getRate() / 100) / 365 * 60
  const exTotal = 3200 + 70 + exInterest + 205

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
        { href: "/guides/letter-before-action", title: "How to write a Letter Before Action", desc: "The mandatory pre-court step — and the letter that gets most invoices paid without ever filing." },
        { href: "/guides/client-not-paying-invoice", title: "Client not paying your invoice? Do this", desc: "The full escalation path from first reminder to formal recovery." },
        { href: "/calculator", title: "Late payment interest calculator", desc: "Work out the exact interest and fixed sum to include in your claim." },
      ]}
    >
      <h2>The honest cost-benefit, before anything else</h2>
      <p>
        Court is the right tool for some unpaid invoices and a waste of time for others, and it's worth being clear-eyed about which yours is before you spend a penny. The small claims track works brilliantly when three things are true:
      </p>
      <ul>
        <li><strong>The debt is clear.</strong> The client accepted the work (or never complained about it), the invoice matches what was agreed, and there's no genuine dispute — they just haven't paid.</li>
        <li><strong>The debtor is solvent.</strong> A trading company or an individual with income and assets. A judgment against an empty shell is a piece of paper.</li>
        <li><strong>You have a paper trail.</strong> A contract or email agreement, the invoice, proof the work was delivered, and your chase correspondence.</li>
      </ul>
      <p>
        When those hold, the economics are good: fees are modest and recoverable, you don't need a solicitor, and the overwhelming majority of straightforward invoice claims end in default judgment or payment before any hearing. When they don't hold, think twice:
      </p>
      <ul>
        <li><strong>The debtor is insolvent or dissolving.</strong> If the company is in liquidation, administration, or has been struck off, you join the queue of unsecured creditors — court action gains you little.</li>
        <li><strong>The work is genuinely disputed.</strong> If the client has a documented, arguable complaint about what was delivered, the claim becomes a contested case rather than a debt collection exercise. Winnable, but slower and less certain.</li>
        <li><strong>The amount is tiny.</strong> A £150 invoice carries a £35 issue fee and several hours of your time. Recoverable if you win, yes — but a final firm letter is often the more proportionate move.</li>
      </ul>

      <h2>Before you file: one letter and two checks</h2>
      <p>
        First, the letter. The courts expect you to have sent a formal <strong>Letter Before Action</strong> (also called a letter before claim) and given the debtor a reasonable period — at least 14 days for a business debtor — to respond. Skipping it can count against you on costs even if you win. It's also, in practice, the document most likely to get you paid without filing anything: see our guide to <a href="/guides/letter-before-action">writing a Letter Before Action</a>.
      </p>
      <p>
        Second, the checks. Before paying a court fee, spend five minutes on the free <strong>Companies House register</strong> (if the client is a limited company): confirm the company still exists, that you have its exact registered name and registered office address, and that it isn't in liquidation, administration, or flagged for strike-off. Suing a dissolved company is suing nobody. For sole traders, confirm you have a current trading or home address — the claim form has to be served somewhere real.
      </p>
      <div className={s.callout}>
        <p>
          Naming the defendant correctly matters more than people expect. "Acme" might trade as Acme Studio but be registered as Acme Digital Holdings Ltd. Sue the registered entity, exactly as spelt on Companies House, or you may have to amend the claim later.
        </p>
      </div>

      <h2>Money Claim Online (MCOL), step by step</h2>
      <p>
        For fixed money claims up to £10,000 in <strong>England and Wales</strong>, the government runs an online service — Money Claim Online, with a newer equivalent at moneyclaims.service.gov.uk — that lets you issue a County Court claim from your laptop. No solicitor, no paper forms, no court visit for an undefended claim.
      </p>
      <ol>
        <li><strong>Register</strong> for the service via gov.uk ("make a court claim for money") using a Government Gateway sign-in.</li>
        <li><strong>Enter the defendant's details</strong> — the exact registered name and address you verified above.</li>
        <li><strong>Write your particulars of claim.</strong> This is a short, factual statement, not legal prose. Cover: what you supplied and when; the invoice number, date, and amount; the agreed payment terms; that payment was not made; and that you claim statutory interest and the fixed sum under the Late Payment of Commercial Debts (Interest) Act 1998. Plain chronology beats legalese.</li>
        <li><strong>Add statutory interest.</strong> For B2B invoices you're entitled to interest at 8% above the Bank of England base rate — currently <strong>{getRate()}% per annum</strong> — from the day after the due date, accruing daily until judgment or payment. State the daily rate in the particulars so interest keeps running after filing. Our <a href="/calculator">calculator</a> gives you the exact figures.</li>
        <li><strong>Add the fixed debt recovery sum</strong> — £40 for debts under £1,000, £70 for £1,000 to £9,999.99, £100 for £10,000 and over. It's a statutory entitlement on every overdue B2B invoice, so claim it.</li>
        <li><strong>Pay the issue fee by card</strong> and submit. The court serves the claim on the defendant for you.</li>
      </ol>

      <h2>What it costs</h2>
      <p>
        The issue fee depends on the total amount claimed (invoice plus interest plus the fixed sum). At the time of writing the bands for an online money claim are:
      </p>
      <ul>
        <li>Up to £300 — <strong>£35</strong></li>
        <li>£300.01 to £500 — <strong>£50</strong></li>
        <li>£500.01 to £1,000 — <strong>£70</strong></li>
        <li>£1,000.01 to £1,500 — <strong>£80</strong></li>
        <li>£1,500.01 to £3,000 — <strong>£115</strong></li>
        <li>£3,000.01 to £5,000 — <strong>£205</strong></li>
        <li>£5,000.01 to £10,000 — <strong>£455</strong></li>
      </ul>
      <p>
        If the claim is defended and reaches a hearing, a hearing fee of between £27 and £346 (again scaling with claim size) is payable closer to the date. Fees are revised periodically — check the current figures on gov.uk before you file. The key point: <strong>court fees are added to your claim</strong>, so if you win, the debtor pays them, not you.
      </p>

      <h2>What happens after you file</h2>
      <p>
        The defendant has <strong>14 days</strong> from service to respond (28 if they file an acknowledgment of service first). From there, one of three things happens:
      </p>
      <ul>
        <li><strong>Silence.</strong> If they don't respond at all, you request <strong>default judgment</strong> online — a County Court judgment (CCJ) for the full amount, interest, and fees, with no hearing. For ignored invoice debts this is the most common outcome.</li>
        <li><strong>Admission.</strong> They admit the debt, in full or in part, sometimes asking to pay by instalments. You can accept or ask the court to set the rate.</li>
        <li><strong>Defence.</strong> They contest the claim. Both sides complete a directions questionnaire, the court offers free telephone mediation, and failing that the case is listed for a small claims hearing — short, informal, no wigs, designed for unrepresented parties.</li>
      </ul>
      <p>
        It's worth saying plainly: <strong>most cases never get near a hearing</strong>. A large share of debtors pay when the claim form lands, because a CCJ on the register wrecks a company's credit for six years (unless paid within a month of judgment). The claim itself is the leverage.
      </p>

      <h2>If they still don't pay after judgment</h2>
      <p>
        A judgment doesn't transfer money by itself. If the debtor ignores it, you apply — for a further recoverable fee — to enforce:
      </p>
      <ul>
        <li><strong>Warrant of control.</strong> County Court bailiffs attend the debtor's premises to collect payment or seize goods. The workhorse option for judgments up to £5,000.</li>
        <li><strong>Attachment of earnings.</strong> For individual debtors in employment — deductions taken directly from salary.</li>
        <li><strong>Third-party debt order.</strong> Freezes and takes the money straight from the debtor's bank account, if you know where they bank.</li>
      </ul>
      <p>
        Be honest with yourself about the limits here: enforcement is effective against debtors who have money and assets, and largely futile against those who don't. This is why the solvency check before filing matters so much.
      </p>

      <h2>Scotland and Northern Ireland</h2>
      <p>
        MCOL covers England and Wales only. In <strong>Scotland</strong>, the equivalent route is <strong>Simple Procedure</strong> in the sheriff court, for claims up to £5,000. In <strong>Northern Ireland</strong>, the <strong>Small Claims</strong> process in the county court covers claims up to £5,000 — but note it generally excludes debts arising from business contracts, so trade debts there usually go through the ordinary civil bill process. The statutory right to late payment interest and the fixed sum applies UK-wide either way.
      </p>

      <h2>A worked example</h2>
      <div className={s.workedExample}>
        <h3>£3,200 invoice, ignored for 60 days, resolved by default judgment</h3>
        <p style={{ fontSize: 14, lineHeight: 1.7, margin: "12px 0" }}>
          Dan, a freelance web developer, invoiced a marketing agency £3,200. The agency ignored his chases and his Letter Before Action. At 60 days overdue he filed via MCOL, claiming the invoice, statutory interest, and the fixed sum. The agency never responded; Dan requested default judgment on day 15 and the agency paid in full within a fortnight to keep the CCJ off the register.
        </p>
        <table>
          <tbody>
            <tr><td>Original invoice</td><td>£3,200.00</td></tr>
            <tr><td>Fixed debt recovery cost (£1,000–£9,999.99 tier)</td><td>+ £70.00</td></tr>
            <tr><td>Interest (60 days at {getRate()}% p.a.)</td><td>+ £{fmt(exInterest)}</td></tr>
            <tr><td>Court issue fee (£3,000.01–£5,000 band)</td><td>+ £205.00</td></tr>
            <tr><td><strong>Dan received</strong></td><td>£{fmt(exTotal)}</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Every penny of the extras — interest, fixed sum, and fee — came out of the debtor's pocket, not Dan's.
        </p>
      </div>

      <h2>The better outcome: never needing court at all</h2>
      <p>
        Almost every invoice that ends up in court got there the same way: weeks of silence, then a flurry of panicked chasing, then escalation. The invoices that never reach this page are the ones chased early, consistently, and with the statutory charges applied from day one. That's exactly what Hielda automates — a full escalating chase sequence citing the Late Payment Act, daily interest calculated for you, the fixed sum applied, all sent on your behalf so you stay out of the awkwardness. Most debts resolve long before a Letter Before Action, let alone a claim form. But if a client does force the issue, you'll arrive at MCOL with a complete, timestamped paper trail — which is precisely what wins these cases.
      </p>
    </GuideLayout>
  )
}
