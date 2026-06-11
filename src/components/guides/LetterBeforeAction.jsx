import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import s from "./guides.module.css"

const TITLE = "Letter Before Action for an unpaid invoice — how to write one (UK)"
const LEDE = "The Letter Before Action is the single most effective document in debt recovery: a formal, factual letter stating what's owed, the deadline to pay, and that court proceedings will follow without it. Here's exactly what to include, how to send it, and what happens next."
const CANONICAL = "/guides/letter-before-action"

const FAQS = [
  {
    q: "Do I need a solicitor to send a letter before action?",
    a: "No. Anyone can send one — there's no requirement for it to come from a solicitor, and a well-written letter from you (or sent on your behalf) carries the same legal weight as the pre-action step. A solicitor's letterhead can add psychological pressure for large or contested debts, but for a straightforward unpaid invoice it's rarely worth the cost.",
  },
  {
    q: "Is a letter before action legally required?",
    a: "Effectively, yes, if you intend to go to court. The Pre-Action Protocol for Debt Claims (for individuals and sole traders) and the Practice Direction on Pre-Action Conduct (for companies) both require you to set out your claim and give the debtor a chance to respond before issuing proceedings. Skip it and the court can penalise you on costs or pause your claim — and you lose the cheapest, most effective recovery step there is.",
  },
  {
    q: "How long do I give them to respond?",
    a: "It depends who the debtor is. If they're an individual or sole trader, the Pre-Action Protocol for Debt Claims gives them 30 days to respond, and you must enclose the official Information Sheet and Reply Form. If they're a limited company, 14 days is the accepted standard for a simple debt under the general Practice Direction. State the deadline as a specific calendar date, not 'within 14 days'.",
  },
  {
    q: "Can I email a letter before action?",
    a: "Yes, and you should — but send it by post as well, keeping proof of postage. Email gives you speed and a timestamp; post defeats the 'we never received it' defence. Send the post copy to the company's registered office (check Companies House) and keep copies of everything, including the proof of postage.",
  },
  {
    q: "What if they ignore it?",
    a: "Once the deadline passes, you're free to issue a court claim — for debts under £10,000 you can do it yourself through gov.uk's online money claims service in about 20 minutes, and the court fee gets added to what the debtor owes. Most undefended claims succeed, and a large share of debtors pay as soon as the claim form lands. Ignoring a Letter Before Action is usually the debtor's last act of stalling, not the start of a long fight.",
  },
  {
    q: "Can I still send one if the invoice is months old?",
    a: "Yes. In England and Wales you have six years from the missed payment to bring a claim, and statutory interest has been accruing daily that whole time — so an old invoice is often worth noticeably more than its face value. That said, the older the debt, the lower the practical recovery rate, so send it now rather than later.",
  },
  {
    q: "Will a letter before action destroy the client relationship?",
    a: "By the time you're sending one, the client has ignored polite chases for a month or more — the relationship is already damaged, just one-sidedly. A factual, unemotional letter is the professional way to resolve it; plenty of clients pay, apologise, and carry on working with the supplier afterwards. The letters that destroy relationships are the angry ones, not the formal ones.",
  },
]

export default function LetterBeforeAction({ onBack, onGetStarted }) {
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
        { href: "/late-payment-letter-template", title: "Free demand letter template", desc: "A ready-to-send letter with the statutory wording and layout done for you." },
        { href: "/guides/small-claims-court-unpaid-invoice", title: "Taking an unpaid invoice to small claims court", desc: "What happens if the letter is ignored — fees, process, and what to expect." },
        { href: "/guides/client-not-paying-invoice", title: "Client not paying? The full step-by-step", desc: "The complete escalation sequence, from polite chase to formal recovery." },
      ]}
    >
      <h2>What a Letter Before Action is</h2>
      <p>
        A Letter Before Action (also called a letter before claim or LBA) is a formal letter telling a debtor that unless they pay what they owe by a stated deadline, you will start court proceedings against them without further notice. It is not a court document and it doesn't need legal language — it's a clear, factual statement of the debt and your intention.
      </p>
      <p>
        It matters for two reasons. First, it's effective: by the time an invoice has survived a month of chasing, the debtor has learned to ignore reminders — but a Letter Before Action signals that the next step is a County Court claim, a judgment, and potentially a mark on their credit record. Faced with that, most debtors pay. In our experience the LBA resolves more stubborn invoices than every other chase email combined.
      </p>
      <p>
        Second, it's required. The courts in England and Wales expect parties to follow pre-action rules before issuing a claim — set out your case, give the debtor a fair chance to respond, try to resolve it without proceedings. If you sue without doing this, the court can penalise you on costs even if you win. The Letter Before Action is how you satisfy that requirement.
      </p>

      <h2>When to send one</h2>
      <p>
        The standard trigger is an invoice around <strong>30 days overdue</strong> where your chases have been ignored, or answered with promises that weren't kept. Sending it earlier than that can look heavy-handed; much later and you've taught the debtor that your deadlines are decorative. If you've already sent two or three escalating chases citing the Late Payment Act and the total keeps being ignored, you have nothing left to gain from another reminder — escalate.
      </p>
      <p>
        One exception: if the client has raised a genuine, specific dispute about the work, deal with the dispute first. A Letter Before Action that ignores an open dispute looks bad if the matter ever reaches a judge.
      </p>

      <h2>The legal requirements depend on who owes you</h2>
      <p>There are two regimes, and it's worth getting this right because the response windows differ:</p>

      <h3>Debtor is an individual or sole trader</h3>
      <p>
        The <strong>Pre-Action Protocol for Debt Claims</strong> applies whenever a business claims a debt from an individual — and that includes sole traders. Under the Protocol your letter must give the debtor <strong>30 days</strong> to respond, and you must enclose the official <strong>Information Sheet and Reply Form</strong> (available from the Ministry of Justice's published Protocol). The letter should also state the amount, how it arises, the interest claimed, and how to pay. If the debtor returns the Reply Form saying they're seeking advice or need time, you're expected to allow it before issuing.
      </p>

      <h3>Debtor is a limited company</h3>
      <p>
        The Debt Protocol doesn't apply to company debtors. Instead the general <strong>Practice Direction on Pre-Action Conduct</strong> applies, which requires a proportionate exchange before proceedings but sets no fixed window. For a simple unpaid invoice, <strong>14 days</strong> is the widely accepted standard deadline, and no Reply Form is needed. Most freelancer invoices fall into this category.
      </p>

      <h2>What to include</h2>
      <p>Every effective Letter Before Action contains the same elements:</p>
      <ul>
        <li><strong>The words "Letter Before Action"</strong> (or "Letter of Claim") stated clearly at the top, so there's no ambiguity about what the letter is</li>
        <li><strong>The parties</strong> — your name/business and theirs, with the invoice reference and date</li>
        <li><strong>The exact amount owed, with a breakdown</strong> — principal, statutory interest, and the fixed recovery sum, each on its own line</li>
        <li><strong>The legal basis</strong> — the contract or agreement, and the Late Payment of Commercial Debts (Interest) Act 1998 for the interest and fixed sum</li>
        <li><strong>A specific deadline</strong> — a calendar date, 14 days out for a company, 30 for an individual or sole trader</li>
        <li><strong>Payment details</strong> — account name, sort code, account number, reference. Don't make paying you require a reply</li>
        <li><strong>The consequence</strong> — that if payment isn't received by the deadline, you will issue court proceedings without further notice, and will seek court fees and further interest on top</li>
      </ul>

      <div className={s.workedExample}>
        <h3>Example breakdown: £3,200 invoice, 45 days overdue</h3>
        <table>
          <tbody>
            <tr><td>Principal (invoice HX-0214, due 27 April)</td><td>£3,200.00</td></tr>
            <tr><td>Fixed debt recovery cost (£1,000–£9,999.99 tier)</td><td>+ £70.00</td></tr>
            <tr><td>Statutory interest (45 days at {getRate()}% p.a.)</td><td>+ £46.36</td></tr>
            <tr><td><strong>Total payable</strong></td><td>£3,316.36</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Interest accrues daily — <code>amount × {getRate()}% ÷ 365 × days</code> — so quote the daily figure too (here about £1.03/day) and note that the total rises until payment. The <a href="/calculator">free calculator</a> does the maths for any invoice.
        </p>
      </div>

      <h2>Getting the tone right</h2>
      <p>
        The letter should read like it was written by an accounts department, not by someone who's owed money and furious about it. That means:
      </p>
      <ul>
        <li><strong>Factual and unemotional.</strong> Dates, amounts, references. No history of how patient you've been, no "frankly disappointed".</li>
        <li><strong>No threats beyond the legal next step.</strong> Stating that you'll issue proceedings is the entire point of the letter. Threatening anything else — bad reviews, telling their clients, "consequences" — weakens it legally and practically.</li>
        <li><strong>No hedging either.</strong> "We may consider possible further action" invites the debtor to keep stalling. "Court proceedings will be issued without further notice" does not.</li>
      </ul>
      <p>
        A judge may one day read this letter. Write it for that audience and you'll automatically strike the right tone.
      </p>

      <h2>How to send it</h2>
      <p>
        Send it <strong>both by email and by post</strong>. Email gives you an instant timestamp; the posted copy — to the company's registered office, which you can check on Companies House — defeats any later claim that the letter never arrived. Get free proof of postage at the Post Office counter (recorded delivery is fine too, but a refused signature can delay things; proof of postage is enough).
      </p>
      <p>
        Keep copies of the letter, the proof of postage, and the sent email. Together with your invoice and earlier chases, that's the complete paper trail a court claim needs.
      </p>

      <h2>What happens next</h2>
      <p>Three outcomes, in descending order of likelihood:</p>
      <ul>
        <li><strong>They pay.</strong> The most common result, often within days. Some debtors will pay the principal but "forget" the interest and fixed sum — it's your call whether to chase the balance, but remember it's money the law says you're owed.</li>
        <li><strong>They respond disputing the debt or asking for time.</strong> Engage, in writing. A genuine dispute needs answering before court; a payment plan is fine if it's written down with dates, with interest continuing to accrue. The pre-action rules expect you to be reasonable here, and being reasonable on paper only strengthens your position.</li>
        <li><strong>Silence.</strong> Once the deadline passes, issue your claim — for debts under £10,000 the <a href="https://www.gov.uk/make-money-claim" target="_blank" rel="noopener noreferrer">online money claim service on gov.uk</a> takes around 20 minutes, the fee is added to the debt, and undefended claims (which most are) proceed to judgment without you setting foot in a courtroom.</li>
      </ul>

      <h2>Don't write it from scratch</h2>
      <p>
        The structure above is standard, and there's no benefit to reinventing it. Hielda publishes a <a href="/late-payment-letter-template">free Letter Before Action template</a> with the statutory wording, the breakdown layout, and the deadline phrasing done for you — copy it, fill in your numbers, and send. And if you'd rather never reach this stage at all, Hielda's automated chasing runs the whole escalation sequence from first reminder onwards, calculating the daily interest and fixed sum as it goes, so the formal letter is a rare last resort rather than a regular chore.
      </p>
    </GuideLayout>
  )
}
