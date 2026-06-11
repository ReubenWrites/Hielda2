import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import s from "./guides.module.css"

const TITLE = "Your legal rights when a client pays late — UK freelancer's guide"
const LEDE = "UK law gives freelancers some of the strongest late-payment protections in the world: automatic interest, fixed compensation per invoice, recoverable chasing costs, and six years to claim. Most freelancers use none of them. Here are the five rights you already have — no contract clause required."
const CANONICAL = "/guides/freelancer-rights-late-payment"

const FAQS = [
  {
    q: "Can I claim interest on invoices that were paid late in the past?",
    a: "Yes. The right to statutory interest and the fixed sum arises automatically when a B2B invoice goes overdue, and it doesn't disappear when the client eventually pays the principal. Within the limitation period — six years in England and Wales — you can still invoice a client for the interest and fixed sum on payments they made late, even years ago. Whether you choose to is a commercial judgement; the legal right is there.",
  },
  {
    q: "Do these rights apply to sole traders?",
    a: "Yes. The Late Payment Act covers commercial debts between two parties acting in the course of a business — and a sole trader invoicing for their work is acting in the course of a business. You don't need a limited company. What matters is that your client is also a business; invoices to private individuals fall outside the Act.",
  },
  {
    q: "Do I need any of this in my contract?",
    a: "No. Statutory interest, the fixed debt recovery cost, and reasonable recovery costs all apply automatically to qualifying B2B invoices, even if your contract and invoice never mention them. A short line on your invoice referencing the Act is still worth including — not to create the right, but so the first chase email surprises nobody.",
  },
  {
    q: "Does the Act apply to overseas clients?",
    a: "Only if the contract is governed by the law of a part of the UK — for example, an English law clause in your contract, or circumstances where English law applies by default. If the contract is governed by another country's law, you'd be looking at that country's late-payment regime instead (the EU has its own directive-based rules). For overseas clients, a governing-law clause in your contract does a lot of quiet work.",
  },
  {
    q: "Can a contract waive my right to statutory interest?",
    a: "Only partially. A contract term can substitute its own remedy for statutory interest, but under the Act it's void unless it provides a 'substantial remedy' for late payment — a meaningful contractual interest rate, for instance. A clause that simply says 'no interest is payable on late payments', or offers a token rate, doesn't meet the test and the statutory rate applies instead.",
  },
  {
    q: "Can I charge late payment fees to consumer clients?",
    a: "Not under the Act — it's B2B only. For consumers you need a contractual term agreed before the work: a stated interest rate and any fixed charges, and they must be a genuine reflection of your costs rather than a punishment, or they risk being struck out as penalties or unfair consumer terms.",
  },
  {
    q: "How do I actually claim these amounts?",
    a: "Add them to the chase. Once an invoice is overdue, restate the total as principal plus accrued statutory interest (currently " + getRate() + "% p.a.) plus the fixed sum, citing the Act. Most clients pay at that point. If they don't, the same figures go into a Letter Before Action and then, if needed, a Money Claim Online — the claim form has boxes for interest and costs.",
  },
]

export default function FreelancerRightsLatePayment({ onBack, onGetStarted }) {
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
        { href: "/guides/late-payment-act-1998-explained", title: "The Late Payment Act 1998 — explained", desc: "Section-by-section plain-English guide to the statute behind all five rights." },
        { href: "/guides/client-not-paying-invoice", title: "Client not paying your invoice?", desc: "What to do, step by step, when a client has gone quiet on an unpaid invoice." },
        { href: "/calculator", title: "Late payment interest calculator", desc: "Plug in any overdue invoice — see exactly what you're owed under the Act." },
      ]}
    >
      <h2>The mindset shift: late payment is a breach, not a favour</h2>
      <p>
        Most freelancers treat a late payment as an awkward social situation — something to tolerate gracefully, mention apologetically, and absorb quietly. The law treats it as what it is: <strong>a breach of contract with statutory remedies attached</strong>. When a business client misses your due date, you don't acquire a grievance. You acquire rights.
      </p>
      <p>
        And UK law is unusually strong here. The Late Payment of Commercial Debts (Interest) Act 1998 — amended in 2002 and 2013 — gives every supplier, down to a one-person sole trader, an automatic package of interest, fixed compensation, and recoverable costs on every overdue B2B invoice. No contract clause needed. No notice to "activate" anything. The tragedy is that the businesses these rights were designed for — freelancers and small suppliers — are the ones who use them least. Here are the five rights, in the order you'll use them.
      </p>

      <h2>Right 1: Statutory interest — automatically</h2>
      <p>
        From the day after your invoice's due date, the unpaid amount accrues interest at <strong>8% above the Bank of England base rate</strong> — currently <strong>{getRate()}% per annum</strong> — calculated daily until it's paid. You don't need an interest clause in your contract. You don't need to have warned the client. The right is created by statute, not by agreement, and it applies to any B2B invoice where both parties were acting in the course of a business.
      </p>
      <p>
        The formula: <code>invoice amount × {getRate()}% ÷ 365 × days overdue</code>. The amounts are modest day by day, but the point isn't the money — it's the meter. A client who knows interest is accruing daily behaves differently from one who knows lateness is free. The full mechanics are in our <a href="/guides/late-payment-act-1998-explained">guide to the Act</a>.
      </p>

      <h2>Right 2: A fixed debt recovery cost on every overdue invoice</h2>
      <p>
        The moment an invoice goes overdue, you're also entitled to a fixed sum as compensation for the cost of recovering the debt — per invoice, regardless of how long it stays unpaid:
      </p>
      <ul>
        <li>Invoices under £1,000 — <strong>£40</strong></li>
        <li>Invoices £1,000 to £9,999.99 — <strong>£70</strong></li>
        <li>Invoices £10,000 or more — <strong>£100</strong></li>
      </ul>
      <p>
        Note the "per invoice". A client who pays five invoices late owes five fixed sums. For freelancers billing monthly, this is often worth more than the interest — and unlike interest, it's claimable in full from day one overdue.
      </p>

      <h2>Right 3: Reasonable recovery costs beyond the fixed sum</h2>
      <p>
        If recovering the debt actually costs you more than the fixed sum — a debt collection agency's commission, a solicitor's letter before action, court fees — you can claim the reasonable excess on top. This was added by the 2013 amendment, and it matters because it changes the economics of escalation: the fixed sum is a floor, not a ceiling. A client who forces you to instruct an agency charging 15% of a £6,000 debt can be asked to bear that cost, not you.
      </p>

      <h2>Right 4: Six years to claim — including on invoices already paid late</h2>
      <p>
        In England and Wales, you have <strong>six years</strong> from the breach to bring a claim, like most contract debts. Two consequences follow, and the second one surprises almost everyone:
      </p>
      <ul>
        <li>An unpaid invoice from 2023 is still fully claimable today — principal, interest, and fixed sum.</li>
        <li>An invoice the client <em>eventually paid</em>, but paid late, still carries a claimable debt: the statutory interest for the late period plus the fixed sum. Paying the principal doesn't extinguish the rest.</li>
      </ul>
      <p>
        That means you can go back through your records and total up what your late payers have actually cost you — and, if you choose, invoice them for it retrospectively. Whether you do so with a current client is a commercial call. With a former client who messed you about, it's often a very easy call.
      </p>

      <h2>Right 5: Court access without a solicitor</h2>
      <p>
        If chasing and a Letter Before Action both fail, you don't need to hire a lawyer to enforce any of the above. Money Claim Online — gov.uk's small claims portal — lets you issue a claim for a debt under £10,000 yourself, online, for a fee that scales with the claim size. Undefended claims (which most unpaid-invoice claims are) succeed at very high rates, and the mere issue of a claim is frequently what triggers payment. Our <a href="/guides/small-claims-court-unpaid-invoice">small claims guide</a> walks through the process step by step.
      </p>

      <h2>What you can't do</h2>
      <p>Strong rights come with edges. Three things the law does <em>not</em> give you:</p>
      <ul>
        <li><strong>Statutory charges on consumer invoices.</strong> The Act is B2B only. If your client is a private individual, you can only charge interest or late fees that were agreed in the contract — and they must be reasonable, not punitive.</li>
        <li><strong>Penalty clauses.</strong> You can't bolt a £500 "late fee" onto a £400 invoice and expect it to survive scrutiny. Contractual charges must reflect a legitimate interest in being paid on time, not punish the client. The statutory amounts are safe precisely because Parliament set them; home-made penalties are where freelancers get into trouble.</li>
        <li><strong>Holding paid work hostage.</strong> Sabotaging or withdrawing work the client has already paid for, as leverage over a separate unpaid invoice, is a quick way to turn a strong position into a counterclaim. Retention of work or IP is different — many freelance contracts state that copyright or deliverables only transfer on payment in full, and if <em>your</em> contract says that, it's real and legitimate leverage: the client using the work without having paid is then infringing. But that lever only exists if your contract creates it, so tread carefully and check your terms before relying on it.</li>
      </ul>

      <h2>The honest part: rights only work if you assert them</h2>
      <p>
        None of the above is self-executing. The Act doesn't send the chase email, and no client volunteers statutory interest unprompted. Most freelancers never claim a penny of it — not because they've weighed it up and declined, but because chasing feels confrontational, the maths feels fiddly, and there's always client work that feels more urgent than admin.
      </p>
      <p>
        The cost of that isn't just the unclaimed interest. It's the training effect: a client who learns your due dates carry no consequences will pay you last, every time, because everyone else's invoices bite and yours don't. Conversely, freelancers who apply the statutory charges calmly and consistently report the same thing — after the first time, that client pays on time. The rights are less a revenue stream than a reputation: <strong>the supplier whose meter runs</strong>.
      </p>

      <h2>A worked example: the retrospective audit</h2>
      <div className={s.workedExample}>
        <h3>Three clients, two years, paid 20–40 days late</h3>
        <p style={{ fontSize: 14, lineHeight: 1.7, margin: "12px 0" }}>
          Dan, a freelance developer, went back through two years of bank statements and matched payment dates against due dates. Three business clients had paid late — all eventually settled, so he'd thought of them as "fine". At the current statutory rate of {getRate()}% p.a., here's what was claimable:
        </p>
        <table>
          <tbody>
            <tr><td>Client A — £2,400, paid 32 days late (£70 fixed + £24.72 interest)</td><td>£94.72</td></tr>
            <tr><td>Client B — £850, paid 21 days late (£40 fixed + £5.75 interest)</td><td>£45.75</td></tr>
            <tr><td>Client C — £6,200, paid 40 days late (£70 fixed + £79.84 interest)</td><td>£149.84</td></tr>
            <tr><td><strong>Total claimable, still within limitation</strong></td><td>£290.31</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          And that's one quiet freelancer with three slightly-late clients. Run your own numbers through the <a href="/calculator">free calculator</a> — the total over six years of invoices is usually a shock.
        </p>
      </div>
      <p>
        Whether Dan invoices those clients retrospectively is up to him — many freelancers reserve the retrospective claim for ex-clients and simply start enforcing on live ones. The point of the audit is different: it converts "clients sometimes pay a bit late, it's fine" into a number, and the number is rarely fine.
      </p>

      <h2>Putting the rights to work</h2>
      <p>
        The pattern for using all five rights is the same: state the due date clearly, chase the day after it passes, restate the total with interest and the fixed sum, escalate predictably. The freelancers who struggle aren't missing knowledge at this point — they're missing follow-through, because every chase is a small act of confrontation they have to initiate themselves. That's the gap Hielda exists to close: it tracks your due dates, calculates the daily interest and fixed sums under the Act, and sends the escalating chases automatically from "the accounts team", so your rights get asserted on every invoice without you drafting a single email. However you do it — tool, template, or sheer discipline — the law has already done its half. The other half is showing up.
      </p>
    </GuideLayout>
  )
}
