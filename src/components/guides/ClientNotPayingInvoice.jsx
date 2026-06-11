import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import s from "./guides.module.css"

const TITLE = "Client not paying your invoice? What to do, step by step"
const LEDE = "An unpaid invoice almost always falls into one of three categories — and the right response is different for each. Here's how to work out which one you're dealing with, and the exact sequence of steps that gets you paid without burning the relationship or ending up in court."
const CANONICAL = "/guides/client-not-paying-invoice"

const FAQS = [
  {
    q: "Can I stop working for a client who hasn't paid?",
    a: "Usually, yes. If the client is in breach of the payment terms, you're generally entitled to suspend further work until the account is settled — and saying so politely (\"I'll pick the next phase back up once invoice 042 is cleared\") is one of the most effective chasing tools there is. Check your contract first: some agreements have specific clauses about suspension or notice. What you shouldn't do is withhold deliverables the client has already paid for.",
  },
  {
    q: "How long can a client legally take to pay an invoice in the UK?",
    a: "Whatever the contract says — and if nothing was agreed, the statutory default is 30 days from delivery of the goods or services or receipt of the invoice, whichever is latest. For B2B contracts, agreed terms longer than 60 days are presumed 'grossly unfair' under the Late Payment Act unless expressly agreed and objectively justified. Once the due date passes, statutory interest starts accruing automatically.",
  },
  {
    q: "Can I charge a late fee if my contract doesn't mention it?",
    a: "Yes, if the client is a business. The Late Payment of Commercial Debts (Interest) Act 1998 gives you a statutory right to interest at 8% above the Bank of England base rate (currently " + getRate() + "% p.a.) plus a fixed debt recovery sum of £40, £70, or £100 depending on the invoice value. The right applies automatically to B2B invoices — no contract term needed. For consumer clients you'd need a contractual term instead.",
  },
  {
    q: "What if the client says the work was bad?",
    a: "Take it seriously, in writing. Ask them to set out specifically what's wrong and by when they raised it. A genuine, documented dispute pauses interest on the disputed portion until it's resolved — but a complaint that only surfaces after you start chasing is usually a delay tactic, and courts see through it. If part of the invoice is undisputed, ask for that part to be paid now while the rest is resolved.",
  },
  {
    q: "What if the client company has gone bust?",
    a: "If the company has entered liquidation or administration, you become an unsecured creditor: register your claim with the insolvency practitioner (you'll usually be contacted, or you can find the practitioner via Companies House). Be realistic — unsecured creditors often recover little or nothing. This is exactly why chasing early matters: invoices that drift for months are the ones that get caught in an insolvency.",
  },
  {
    q: "Should I phone the client or keep everything in writing?",
    a: "Phone calls are fine for finding out what's going on — they're quick and harder to ignore. But always follow up with an email summarising what was said and agreed (\"as discussed, you'll pay by Friday the 14th\"). If you ever need to escalate, the written trail is what counts. A verbal promise on its own is worth nothing.",
  },
  {
    q: "How long do I have to take legal action over an unpaid invoice?",
    a: "Six years from the date the payment fell due, in England and Wales (five years in Scotland). In practice you shouldn't get anywhere near that — recovery rates fall sharply after 90 days, so the useful window is measured in weeks, not years.",
  },
]

export default function ClientNotPayingInvoice({ onBack, onGetStarted }) {
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
        { href: "/guides/letter-before-action", title: "Letter Before Action — how to write one", desc: "The formal pre-court letter that gets most stubborn invoices paid within days." },
        { href: "/calculator", title: "Late payment interest calculator", desc: "Work out exactly what you're owed in interest and the fixed debt recovery cost." },
        { href: "/guides/how-to-chase-late-invoices", title: "How to chase late invoices professionally", desc: "The day-by-day chasing timeline used by professional credit-control teams." },
      ]}
    >
      <h2>First, work out why they're not paying</h2>
      <p>
        Non-payment feels personal, but it almost never is. Before you do anything, it helps to know which of the three classic situations you're in, because the right response differs sharply:
      </p>
      <ul>
        <li><strong>Admin failure.</strong> The invoice went to the wrong inbox, lacked a PO number, got stuck in an approval queue, or simply got buried. This is the most common cause by a wide margin — and it's solved by reminders, not threats.</li>
        <li><strong>Cash-flow trouble.</strong> The client wants to pay but can't, at least not right now. The answer here is a written payment plan with interest still running — not silence, and not pretending the problem doesn't exist.</li>
        <li><strong>Bad faith.</strong> The client could pay but has decided not to, hoping you'll give up or accept less. This is the rarest case, and the only one that genuinely needs escalation. The good news: bad-faith payers fold quickly once they see you know your legal rights and follow a process.</li>
      </ul>
      <p>
        You usually can't tell which one you're dealing with from the outside. That's fine — the step-by-step sequence below tests each explanation in turn, cheapest first.
      </p>

      <h2>The five steps, in order</h2>

      <h3>Step 1: Rule out the boring explanations</h3>
      <p>
        Before assuming the worst, check the basics. A surprising share of "unpaid" invoices were never properly received or can't be processed:
      </p>
      <ul>
        <li>Did the invoice go to the right address? Many companies have a dedicated accounts inbox, and an invoice sent to your day-to-day contact may never reach it.</li>
        <li>Does it have everything their system needs — PO number, correct legal entity name, bank details, VAT number if applicable?</li>
        <li>Is it "with accounts"? Ask your contact directly: <em>"Can you confirm invoice 042 has been approved and when it's scheduled for payment?"</em> A specific question gets a specific answer, and puts a date on record.</li>
      </ul>
      <p>
        Five minutes of checking here saves weeks of chasing the wrong problem.
      </p>

      <h3>Step 2: The polite chase</h3>
      <p>
        If the invoice is correct and received, send a short, friendly reminder the day after the due date. Assume good faith — because at this stage it usually is good faith. Something like:
      </p>
      <div className={s.calloutGrey}>
        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "#475569" }}>
          <em>Hi [Name], a quick note that invoice [Ref] for £[Amount] fell due on [Date] and doesn't appear to have arrived yet. Could you let me know when it's scheduled for payment? If anything's missing your end, just say. Thanks!</em>
        </p>
      </div>
      <p>
        Keep it to one paragraph, keep it warm, and give it a few working days. If you get a vague reply ("it's being processed"), follow up with a date-specific question. If you get silence, move to step 3 — don't send the same polite email four times. Repetition without escalation teaches the client that ignoring you is free.
      </p>

      <h3>Step 3: Add statutory charges</h3>
      <p>
        This is the step most freelancers skip, and it's the one that changes everything. If your client is a business, the <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong> gives you an automatic right — no contract term needed — to charge on any overdue invoice:
      </p>
      <ul>
        <li><strong>Statutory interest</strong> at 8% above the Bank of England base rate, currently <strong>{getRate()}% per annum</strong>, accruing daily from the day after the due date</li>
        <li><strong>A fixed debt recovery sum</strong>: £40 for invoices under £1,000, £70 for £1,000 to £9,999.99, and £100 for £10,000 or more</li>
      </ul>
      <p>
        The formula for the interest is <code>invoice amount × {getRate()}% ÷ 365 × days overdue</code>. Send a firm, professional email stating the new total, citing the Act, and noting that interest continues to accrue daily. Most clients have never seen interest applied to a late invoice — the first time it happens, they take you seriously, because now the delay costs <em>them</em> money instead of you.
      </p>
      <div className={s.callout}>
        <p>
          Don't call it a "fine" or a "penalty". The Act calls it statutory interest and a fixed sum for debt recovery costs — compensation set by Parliament, not a punishment you invented. The statutory wording is much harder to argue with.
        </p>
      </div>

      <h3>Step 4: The Letter Before Action</h3>
      <p>
        If the invoice is around 30 days overdue and your chases have been ignored or met with broken promises, send a <strong>Letter Before Action</strong> — a formal letter stating the full amount owed, a deadline to pay, and that you'll start court proceedings without further notice if it isn't met. It's the standard pre-court step, and in practice it's the single most effective document in the whole sequence: most debtors pay within days of receiving one, because it signals you're genuinely prepared to escalate.
      </p>
      <p>
        We've written a full guide to <a href="/guides/letter-before-action">writing a Letter Before Action</a>, and there's a <a href="/late-payment-letter-template">free template</a> you can copy and send today.
      </p>

      <h3>Step 5: Formal recovery</h3>
      <p>If the Letter Before Action deadline passes in silence, you have three realistic routes:</p>
      <ul>
        <li><strong>Money Claim Online.</strong> For straightforward debts under £10,000, you can issue a County Court claim yourself through gov.uk's online money claims service. Fees scale with the claim — from around £35 for the smallest claims up to around £455 near the £10,000 mark (check the current figures on <a href="https://www.gov.uk/make-court-claim-for-money/court-fees" target="_blank" rel="noopener noreferrer">gov.uk</a>), and the fee is added to what the client owes. Undefended claims, which most unpaid-invoice claims are, almost always succeed — and issuing the claim is often enough to trigger payment by itself.</li>
        <li><strong>Debt recovery agency.</strong> Typically 10–20% of the recovered sum, usually no win no fee. Sensible if you'd rather not deal with court paperwork, especially for repeat or larger debts.</li>
        <li><strong>Solicitor.</strong> The most expensive option, appropriate for large debts, messy facts, or where you expect the client to defend the claim. For a simple unpaid invoice with a clear paper trail, you rarely need one.</li>
      </ul>

      <h2>What NOT to do</h2>
      <p>
        A few tactics feel satisfying in the moment and reliably make things worse:
      </p>
      <ul>
        <li><strong>Public shaming on social media.</strong> Naming and shaming a non-paying client online exposes you to a defamation claim — even a true statement framed carelessly can be actionable, and a false or exaggerated one certainly is. It also signals to future clients that disputes with you go public. Keep the pressure private and procedural.</li>
        <li><strong>Withholding work the client has already paid for.</strong> Suspending <em>future</em> work over an unpaid invoice is fair game. Holding hostage deliverables from a previous, paid invoice is a breach on your side and hands the client a counterclaim.</li>
        <li><strong>Accepting endless verbal promises.</strong> "It'll go out this week" is not a payment plan. Get every promise in writing with a date attached, and treat a missed written promise as the trigger for the next escalation step.</li>
        <li><strong>Discounting to make it go away.</strong> Knocking 15% off an invoice to get it paid teaches the client that paying late earns a discount. You'll be negotiating every invoice from then on. The law lets you charge <em>more</em> for late payment, not less — use it.</li>
      </ul>

      <h2>A worked example</h2>
      <div className={s.workedExample}>
        <h3>£2,400 invoice, paid 38 days late</h3>
        <p style={{ fontSize: 14, lineHeight: 1.7, margin: "12px 0" }}>
          Dan, a freelance web developer, invoiced a marketing agency £2,400, due on 30 days net. The polite chase got a "it's with accounts". At day 10 he added statutory charges; at day 30 he sent a Letter Before Action with a 14-day deadline. The agency paid in full on day 38.
        </p>
        <table>
          <tbody>
            <tr><td>Original invoice</td><td>£2,400.00</td></tr>
            <tr><td>Fixed debt recovery cost (£1,000–£9,999.99 tier)</td><td>+ £70.00</td></tr>
            <tr><td>Interest (38 days at {getRate()}% p.a.)</td><td>+ £29.36</td></tr>
            <tr><td><strong>Dan received</strong></td><td>£2,499.36</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          No court, no solicitor, no shouting — just a sequence the agency could see wasn't going to stop. Run your own numbers in the <a href="/calculator">free calculator</a>.
        </p>
      </div>

      <h2>The real reason invoices stay unpaid</h2>
      <p>
        Here's the uncomfortable truth: the sequence above works, but most freelancers don't follow it. Not because it's complicated — because chasing is emotionally draining, and the steps quietly slip. The first chase goes out a week late, the statutory charges never get calculated, the Letter Before Action stays a someday job. Meanwhile the client learns that nothing happens when they don't pay you.
      </p>
      <p>
        The fix is to take yourself out of the loop. Hielda runs this entire sequence automatically: it tracks due dates, sends the polite chase, adds statutory interest and the fixed sum, escalates on schedule, and keeps you CC'd throughout — so the client deals with "the accounts team" while you stay the friendly human contact. However you do it, the principle is the same: be consistent, be unemotional, and be inevitable.
      </p>
    </GuideLayout>
  )
}
