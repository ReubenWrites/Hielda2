import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import s from "./guides.module.css"

const TITLE = "Invoice payment terms for UK freelancers: 30 days, 14, or 7?"
const LEDE = "Most freelancers copy '30 days' onto their invoices because it looks standard — without realising it's just the legal default, not a rule. Here's how UK payment terms actually work, what to choose for each type of client, and how to state them so they hold up when a payment runs late."
const CANONICAL = "/guides/invoice-payment-terms-uk"

const FAQS = [
  {
    q: "Are 7-day payment terms legal in the UK?",
    a: "Yes, completely. There is no minimum payment period in UK law. The 30-day figure people treat as 'standard' is only the statutory default that applies when nothing was agreed — if your client accepts 7-day terms before work starts, those are the terms. Plenty of freelancers and small agencies use 7 or 14 days without issue.",
  },
  {
    q: "What are standard payment terms in the UK?",
    a: "There's no legal standard, only conventions. 30 days is the most common B2B term and is also the statutory default under the Late Payment Act framework if nothing was agreed. Larger companies often push for 60 or 90 days; freelancers increasingly use 7 or 14. B2B terms longer than 60 days must not be 'grossly unfair' to be enforceable.",
  },
  {
    q: "When does the clock start — invoice date or delivery?",
    a: "If you've agreed a payment period in the contract, it runs from whatever trigger the contract states — usually the invoice date. If nothing was agreed, the statutory default is 30 days from delivery of the goods, performance of the services, or the client's receipt of the invoice, whichever is latest. This is one reason to always state an explicit due date: it removes the argument about when the clock started.",
  },
  {
    q: "Can a client impose their own payment terms?",
    a: "Only if you agree to them. Payment terms are part of the contract, and a contract needs both parties' agreement. In practice, large companies present their terms as non-negotiable and most suppliers accept — which is a commercial decision, not a legal obligation. If their terms exceed 60 days, the Late Payment Act says the term must not be grossly unfair to the supplier, or it falls back towards the statutory position.",
  },
  {
    q: "Should payment terms be in the contract or on the invoice?",
    a: "Both — but the contract (or accepted quote) is what counts legally. Terms that appear for the first time on the invoice arrive after the contract was formed, so a client can argue they never agreed to them. Agree the terms in writing before work starts, then restate them on every invoice with an explicit due date.",
  },
  {
    q: "Can I charge interest if a client misses my payment terms?",
    a: "Yes — on any B2B invoice, automatically. The Late Payment of Commercial Debts (Interest) Act 1998 entitles you to statutory interest at 8% above the Bank of England base rate (currently " + getRate() + "% p.a.) plus a fixed debt recovery cost of £40, £70, or £100 depending on invoice value. You don't need a contract clause; the right applies the day after your agreed due date passes.",
  },
  {
    q: "Do shorter payment terms actually get you paid faster?",
    a: "Somewhat — but chasing discipline matters more than the number. A 7-day term chased consistently beats a 7-day term chased never, and a 30-day term with reminders before the due date and statutory charges the day after will outperform shorter terms that are never enforced. Set the shortest term the client type will realistically accept, then enforce it every time.",
  },
]

export default function InvoicePaymentTermsUk({ onBack, onGetStarted }) {
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
        { href: "/guides/late-payment-act-1998-explained", title: "The Late Payment Act 1998 — explained", desc: "The UK statute that gives you the right to charge interest and a fixed sum on overdue invoices." },
        { href: "/guides/how-to-chase-late-invoices", title: "How to chase late invoices professionally", desc: "A practical day-by-day playbook for freelancers and SMEs." },
        { href: "/calculator", title: "Late payment interest calculator", desc: "Work out exactly what you're owed in interest and the fixed debt recovery cost." },
      ]}
    >
      <h2>What payment terms actually are</h2>
      <p>
        Payment terms are simply the agreed window between when you invoice and when the money is due. "Net 30" means payment is due 30 days after the invoice date; "net 7" means seven days. That's it — there's no register of approved terms, no legal minimum, and no rule that says business invoices must allow 30 days.
      </p>
      <p>
        What UK law does provide is a <strong>default</strong>. Under the framework of the Late Payment of Commercial Debts (Interest) Act 1998, if you and a business client never agreed a payment period, the invoice falls due <strong>30 days</strong> from delivery of the goods, performance of the services, or the client's receipt of the invoice — whichever is latest. After that, statutory interest and the fixed debt recovery cost start to apply automatically. (Full breakdown in our <a href="/guides/late-payment-act-1998-explained">guide to the Act</a>.)
      </p>
      <p>
        So the 30 days everyone treats as "standard" is really just the fallback for people who never discussed terms at all. If you agree something different in writing — 7 days, 14 days, payment on completion — that agreement is what governs.
      </p>

      <h2>The case for shorter terms</h2>
      <p>
        Here's the uncomfortable framing: every day of payment terms you extend is an interest-free loan from you to your client. A £3,000 invoice on 60-day terms means you've financed your client's business for two months, for free, while your own rent doesn't wait. <strong>You're a freelancer, not a bank.</strong>
      </p>
      <p>
        The 30/60/90-day norms at large companies exist because of <em>their</em> internal processes — batch payment runs, multi-step approvals, working-capital targets set by their finance team — not because of any law or industry standard you're obliged to honour. A norm built for purchase orders between two corporations doesn't have to apply to a sole trader invoicing for a week's work.
      </p>
      <div className={s.callout}>
        <p>
          Freelancers can and do use 7- or 14-day terms, and clients accept them far more often than people expect — especially when the terms were stated on the quote rather than sprung on the first invoice. The worst realistic outcome of proposing short terms is a counter-offer of 30 days. The worst outcome of never asking is funding everyone else's cash flow indefinitely.
        </p>
      </div>

      <h2>What terms to choose, by client type</h2>

      <h3>Consumers and individuals: on completion, or 7 days</h3>
      <p>
        For private individuals — homeowners, couples, personal-brand clients — there's no accounts department and no payment run. The money either exists or it doesn't, and a long term just gives it time to get spent. Ask for payment on completion, or 7 days at most. Many freelancers take a deposit up front and the balance on delivery, which is even better.
      </p>

      <h3>Small businesses: 14 days</h3>
      <p>
        Small businesses are usually run by one or two people who pay invoices the same way you do — when reminded, from a banking app. Fourteen days is comfortably enough time for anyone who intends to pay, while keeping the invoice fresh in their memory. There's rarely a process reason for a small business to need 30 days; if one insists on it, that tells you something about their cash position.
      </p>

      <h3>Larger companies with accounts departments: 30 days</h3>
      <p>
        Once a client has a finance team, a supplier-onboarding form, and monthly payment runs, 30 days is usually the practical floor — their systems are built around it, and a 7-day term will simply get processed in the next run regardless of what your invoice says. Fighting for 14 days here is usually wasted energy.
      </p>
      <p>
        The leverage with bigger clients isn't the number on the invoice — it's <strong>what happens the day after the number passes</strong>. A supplier who chases on day one overdue, adds statutory interest, and follows a visible escalation routine gets moved up the payment queue. One who waits three weeks to send a meek nudge gets paid whenever it suits. Chase discipline beats term length every time; our <a href="/guides/how-to-chase-late-invoices">chasing playbook</a> covers the exact sequence.
      </p>

      <h2>How to state terms so they actually stick</h2>
      <p>Payment terms fail for boring procedural reasons more often than bad faith. Four rules close the gaps:</p>
      <ul>
        <li><strong>Agree terms before work starts.</strong> Put them on the quote, proposal, or contract the client accepts. Terms that first appear on the invoice arrive after the contract was formed, and a difficult client can argue they never agreed to them.</li>
        <li><strong>Restate them on the invoice.</strong> The contract makes the terms binding; the invoice makes them visible to whoever actually processes the payment.</li>
        <li><strong>Give a due date, not just "net 30".</strong> "Payment due by 14 July 2026" cannot be misread, miscounted, or reinterpreted from the wrong start date. "Net 30" can be all three.</li>
        <li><strong>Say what happens if it's missed.</strong> One calm line — <em>"Overdue invoices are subject to statutory interest and compensation under the Late Payment of Commercial Debts (Interest) Act 1998"</em> — costs nothing and means the first chase email surprises nobody. (The right applies even without this line, but stating it up front sets expectations.)</li>
      </ul>

      <h2>Early payment discounts vs late payment charges</h2>
      <p>
        A common suggestion is to offer a discount for fast payment — "2% off if paid within 7 days". Our honest take: <strong>don't</strong>. A 2% discount for paying within a week is roughly 100% annualised — you're paying a steep premium just to receive what you're already owed. Worse, it quietly reframes paying on time as a favour deserving a reward, and paying on the due date as the unrewarded baseline. Clients learn that your prices are soft.
      </p>
      <p>
        The better instrument already exists in statute. On any overdue B2B invoice you can add interest at 8% above the Bank of England base rate — currently <strong>{getRate()}% per annum</strong> — plus a fixed debt recovery cost of £40, £70, or £100 depending on invoice value, automatically and without any contract clause. The discount erodes your margin to reward behaviour that should be standard; the statutory charge protects your margin by making lateness cost the right party. Use the stick the law gives you, not a carrot from your own pocket.
      </p>

      <h2>The 60-day cap</h2>
      <p>
        B2B parties can agree payment periods longer than the 30-day default — but under the Late Payment Act framework, a term longer than <strong>60 days</strong> must not be "grossly unfair" to the supplier, or it isn't enforceable and the position falls back towards the statutory default. Whether a long term is grossly unfair depends on the circumstances: the size imbalance between the parties, whether there's any objective commercial justification, and how far the term deviates from good commercial practice. A 120-day term imposed on a sole trader for a routine piece of work is exactly the kind of arrangement the rule exists to catch.
      </p>

      <h2>When a client says "we only pay on 90-day terms"</h2>
      <p>You have three legitimate moves, and one rule of law behind all of them:</p>
      <ul>
        <li><strong>Negotiate.</strong> "Our standard terms are 14 days; we can extend to 30 for ongoing engagements" is a normal commercial conversation. Many "fixed" terms turn out to be defaults nobody has questioned — and some companies will pay small suppliers faster on request precisely because the sums are immaterial to them.</li>
        <li><strong>Price it in.</strong> If they won't move, charge for the financing you're providing. Ninety days of waiting on a £10,000 project at your cost of money is a real number — add it to the quote. If the client would rather pay more than pay sooner, at least you're being compensated.</li>
        <li><strong>Decline.</strong> A client who pays in 90 days consumes three months of your working capital per project. For a freelancer without reserves, one slow-paying anchor client can be more dangerous than no client.</li>
      </ul>
      <p>
        And the backstop: because 90 days exceeds the 60-day threshold, the term is only enforceable if it isn't grossly unfair to you. You'd rather never litigate the point — but it's worth knowing that "take it or leave it" terms from a much larger counterparty are precisely where the law is most sceptical.
      </p>

      <h2>Terms are a promise — enforcement is the product</h2>
      <p>
        Whatever number you choose, it only means something if the due date has consequences. In our experience at Hielda, the freelancers who get paid fastest aren't the ones with the shortest terms — they're the ones whose invoices come with a reminder before the due date, a firm chase the day after, and statutory interest accruing from day one, every single time. Hielda runs that routine automatically on every invoice you send, so your 14-day term behaves like a 14-day term instead of a polite suggestion. Pick your number, state it before the work starts, and let the follow-through do the rest.
      </p>
    </GuideLayout>
  )
}
