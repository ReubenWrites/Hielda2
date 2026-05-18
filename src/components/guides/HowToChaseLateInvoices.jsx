import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import s from "./guides.module.css"

const TITLE = "How to chase late invoices — a practical playbook for UK freelancers"
const LEDE = "When a client misses an invoice payment, what you do in the first 48 hours, the first two weeks, and the first month matters more than anything else. Here's the day-by-day timeline used by professional accounts teams — adapted for solo freelancers and small businesses."
const CANONICAL = "/guides/how-to-chase-late-invoices"

const FAQS = [
  {
    q: "How long should I wait before chasing a late invoice?",
    a: "Don't wait. Send a friendly reminder five days before the due date, and another the day before. If the invoice goes overdue, follow up the very next day with a firmer note that adds statutory charges. The longer you leave it, the harder it gets — both practically and psychologically.",
  },
  {
    q: "Should I be polite or firm when chasing?",
    a: "Both, in sequence. The first one or two reminders should be polite and assume good faith — most late payments are admin slip-ups. From the formal notice stage onwards, switch to professional and firm, with a clear reference to the Late Payment Act and the exact amount owed including interest and the fixed debt recovery cost. Politeness without firmness gets ignored.",
  },
  {
    q: "Can I charge fees for chasing under UK law?",
    a: "Yes. The Late Payment of Commercial Debts Act 1998 entitles you to charge statutory interest (8% above Bank of England base rate, currently " + getRate() + "% p.a.) plus a fixed sum for debt recovery costs (£40, £70, or £100 depending on invoice value) on any overdue B2B invoice. You don't need it in your contract — the right applies automatically.",
  },
  {
    q: "When should I escalate to formal recovery?",
    a: "If the invoice is more than 30 days overdue and the client has either ignored your chases or made promises they haven't kept, it's reasonable to send a Letter Before Action and prepare for County Court or a debt recovery agency. By that point you've given them every opportunity.",
  },
  {
    q: "What if my client says they can't pay?",
    a: "Get the conversation onto paper. If they genuinely can't pay right now, offer a written payment plan with a clear schedule and the understanding that statutory interest continues to accrue. If they're just deflecting, the written record helps if you later need to escalate. Either way, don't accept verbal promises.",
  },
  {
    q: "Will chasing damage the client relationship?",
    a: "It can — if you chase personally and confrontationally. The trick is to separate yourself from the chase. Use formal templates that reference the law, not your feelings. Better yet, use a tool that sends them on your behalf so the client receives notices from 'the accounts team', not from you. Big companies do this for a reason: it preserves the working relationship while still extracting payment.",
  },
  {
    q: "What if they ignore everything?",
    a: "After a Letter Before Action goes unanswered for 14 days, you have three options: (1) issue a Money Claim Online via gov.uk for under £10,000 — DIY, low fee, very effective; (2) refer to a debt recovery agency, typically 10–20% of the recovered sum; (3) instruct a solicitor for a formal demand. Most clients pay long before any of these — the Letter Before Action is usually enough.",
  },
]

export default function HowToChaseLateInvoices({ onBack, onGetStarted }) {
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
        { href: "/calculator", title: "Late payment interest calculator", desc: "Work out exactly what you're owed in interest and the fixed debt recovery cost." },
        { href: "/late-payment-letter-template", title: "Free demand letter template", desc: "Ready-to-send letter for invoices that aren't responding to gentle chases." },
      ]}
    >
      <h2>Why timing is everything</h2>
      <p>
        The probability of getting paid on a late invoice declines steeply with time. Industry data is brutal: after 90 days, the recovery rate drops from near-100% to around 70%, and at 6 months it's closer to 50%. Every week you wait is money you may not see.
      </p>
      <p>
        The good news: a clear, consistent chasing routine, started early, recovers the overwhelming majority of late payments without any need to escalate. Most "late payers" are actually accounts departments with a paper-pushing problem — not bad-faith actors. The sooner and more clearly you remind them, the sooner you're paid.
      </p>

      <h2>The five-stage timeline</h2>
      <p>
        Use this whether you're chasing manually, by template, or with an automated tool. The stages and their timing are based on what professional credit-control departments do.
      </p>

      <h3>Stage 1: Friendly reminders (days −5 and −1)</h3>
      <p>
        Send a single-paragraph email a few days <em>before</em> the due date. Tone: assume good faith. Goal: surface the invoice so it doesn't get buried.
      </p>
      <div className={s.calloutGrey}>
        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "#475569" }}>
          <em>Hi [Name], just a quick note that invoice [Ref] for £[Amount] is due on [Date] — payment by then keeps everything on the original terms. Let me know if anything's needed your end. Thanks!</em>
        </p>
      </div>
      <p>
        A friendly nudge five days before is the single highest-leverage thing you can do. Most invoices that would otherwise have slipped through the cracks get paid on time after this reminder alone.
      </p>

      <h3>Stage 2: First chase (day +1)</h3>
      <p>
        The day after the due date, send a firm but professional follow-up. Reference the Late Payment Act explicitly. Add the statutory interest and the fixed debt recovery cost. <strong>This is the most important email in the sequence</strong> — it sets the tone for everything that follows.
      </p>
      <div className={s.callout}>
        <p>
          The reason this email works: most clients have never seen interest applied to an overdue invoice. The first time it happens, they take you seriously. They pay quickly to stop the meter. After this email, the dynamic shifts: <em>they</em> are the one being inconvenienced, not you.
        </p>
      </div>

      <h3>Stage 3: Regular chasing (days +6 to +25)</h3>
      <p>
        If the first chase doesn't trigger payment, send escalating reminders every 2–4 days for the next three to four weeks. Each one should:
      </p>
      <ul>
        <li>Restate the current total owed (original + accruing interest + fixed sum)</li>
        <li>Reference any previous communications</li>
        <li>Note that interest continues to accrue daily</li>
        <li>Indicate the next step if unresolved (formal letter, recovery referral)</li>
      </ul>
      <p>
        The aim isn't to be aggressive — it's to be inevitable. The client should understand that nothing will happen to make the problem go away except payment.
      </p>

      <h3>Stage 4: Letter Before Action (day +30)</h3>
      <p>
        At around 30 days overdue, send a formal Letter Before Action. This is the standard pre-court step under the Practice Direction on Pre-Action Conduct, and it triggers a 14- or 30-day response window depending on the type of dispute.
      </p>
      <p>
        Use our <a href="/late-payment-letter-template">free template</a> — it includes the exact statutory wording and the layout required.
      </p>
      <p>
        The Letter Before Action is, in practice, the most effective single document in the whole sequence. Many clients who've absorbed the earlier emails will pay within days of receiving this one, because it signals you're prepared to escalate.
      </p>

      <h3>Stage 5: Formal recovery (day +45 onwards)</h3>
      <p>If the Letter Before Action also goes unanswered, you have three real options:</p>
      <ul>
        <li><strong>Money Claim Online (MCOL).</strong> For straightforward debts under £10,000, you can issue a claim through gov.uk's MCOL portal. Fees scale with claim size (around £35 for a £1,000 claim, £185 for £5,000–10,000). Win rate for undefended claims is very high — and even the issue of the claim often triggers payment.</li>
        <li><strong>Debt recovery agency.</strong> Typically charge 10–20% of the recovered sum, no win no fee. Useful if you'd rather not handle court paperwork. Pick one regulated by the FCA.</li>
        <li><strong>Solicitor's letter / instructed claim.</strong> The most expensive route but appropriate for larger debts, ambiguous facts, or where you suspect the client will defend the claim.</li>
      </ul>

      <h2>Maintaining the relationship</h2>
      <p>
        Many freelancers don't chase because they're worried about damaging the client relationship. The data, and our experience, suggests the opposite: <strong>clients respect suppliers who manage their cash flow professionally</strong>. What does damage relationships is:
      </p>
      <ul>
        <li>Chasing emotionally or accusingly (<em>"you still haven't paid me"</em>)</li>
        <li>Disappearing for weeks then resurfacing with an angry email</li>
        <li>Bringing it up at the start of every meeting</li>
        <li>Discounting your fee to make the late-payment problem go away</li>
      </ul>
      <p>
        What doesn't damage them: a series of clearly-worded, dispassionate emails that look like they came from an accounts department. Which is why so many freelancers use tools that send chases on their behalf — the chase is professional and impersonal, while you stay the warm human contact.
      </p>

      <h2>A worked example</h2>
      <div className={s.workedExample}>
        <h3>£4,500 invoice, paid 21 days late</h3>
        <p style={{ fontSize: 14, lineHeight: 1.7, margin: "12px 0" }}>
          Sarah, a freelance designer, invoiced an agency for £4,500 on 1 March, due 31 March (30 days net). When it went unpaid on 1 April, she sent the first chase citing the Late Payment Act. Three more chases at days 7, 14, and 21. The agency paid on day 21 to "avoid further interest".
        </p>
        <table>
          <tbody>
            <tr><td>Original invoice</td><td>£4,500.00</td></tr>
            <tr><td>Fixed debt recovery cost (£1,000–£9,999.99 tier)</td><td>+ £70.00</td></tr>
            <tr><td>Interest (21 days at {getRate()}% p.a.)</td><td>+ £30.41</td></tr>
            <tr><td><strong>Sarah received</strong></td><td>£4,600.41</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          The £100.41 extra covered her time spent chasing — and the agency now pays her on time every month, because they know she enforces.
        </p>
      </div>

      <h2>What to send vs what to do yourself</h2>
      <p>
        At Hielda we've seen thousands of late invoices, and the pattern is consistent: <strong>freelancers who send chases manually do it inconsistently, late, or not at all</strong>, because chasing is emotionally taxing. The work that produced the invoice is fun; the chasing is not.
      </p>
      <p>
        The single biggest unlock for getting paid faster is taking yourself out of the chasing loop. Whether that's a virtual assistant, a credit-control freelancer, or a tool — anything that sends the chases without you having to write each one. Hielda is one option: it runs the entire timeline above automatically, calculates daily interest, applies the fixed debt recovery cost, and escalates through 19 stages over 45 days. You're CC'd on everything but never have to draft a single email.
      </p>
    </GuideLayout>
  )
}
