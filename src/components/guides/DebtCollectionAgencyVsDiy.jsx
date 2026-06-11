import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import s from "./guides.module.css"

const TITLE = "Debt collection agency, DIY, or automation? Recovering unpaid invoices compared"
const LEDE = "By the time most freelancers start googling debt collection agencies, the invoice is months old and the cheaper options have quietly expired. This guide compares what actually works at each stage — chasing it yourself, instructing an agency, going legal, or automating the whole thing — with honest numbers for each."
const CANONICAL = "/guides/debt-collection-agency-vs-diy"

const FAQS = [
  {
    q: "How much does a debt collection agency cost in the UK?",
    a: "Most commercial debt collection agencies work on a no-win-no-fee commission, typically somewhere between 8% and 20% of whatever they recover — quotes range from around 5% for large, fresh debts to 25% or more for old, small, or difficult ones. Some charge fixed fees instead, particularly for letter-only services. Always check the contract for admin or 'instruction' fees that apply even if nothing is recovered.",
  },
  {
    q: "Do debt collection agencies work for small invoices?",
    a: "They'll often take them, but the economics are poor for everyone. A 15% commission on a £400 invoice is £60 — barely worth the agency's time, which means small debts get less attention. Some agencies set minimum debt values (commonly £100–£500) or charge minimum fees that eat a large slice of a small invoice. For sums under £1,000, chasing it yourself, a fixed-fee solicitor's letter, or Money Claim Online usually makes more financial sense.",
  },
  {
    q: "Can a debt collector visit my client?",
    a: "Some agencies offer doorstep visits, but a collector has no right of entry and no power to seize anything — that requires a court judgment and enforcement officers. In practice, almost all commercial collection is done by letter, email, and phone. Anyone implying they can 'send the bailiffs round' without a County Court Judgment first is misrepresenting the law, which is itself a red flag.",
  },
  {
    q: "Will using an agency damage the client relationship?",
    a: "Usually, yes — receiving a letter from a third-party collector signals the commercial relationship is over, and most businesses treat it that way. That's fine if the relationship is already dead. If you want to keep working with the client, exhaust the professional chasing sequence first: structured reminders citing the Late Payment Act recover most invoices without anyone losing face.",
  },
  {
    q: "What's the minimum debt an agency will take?",
    a: "There's no legal minimum, but many agencies set commercial thresholds — typically £100 to £500, and some won't engage seriously below £1,000. Below those levels the commission doesn't cover their costs. Fixed-fee letter services and Money Claim Online have no such floor, which is why they're usually the better route for small invoices.",
  },
  {
    q: "Are debt collection fees recoverable from the debtor?",
    a: "Partially. On B2B invoices, the Late Payment of Commercial Debts (Interest) Act 1998 gives you an automatic right to a fixed sum per invoice (£40, £70, or £100 depending on value) plus statutory interest at 8% above the Bank of England base rate — currently " + getRate() + "% p.a. If your reasonable recovery costs exceed the fixed sum — an agency's commission often will — the Act lets you claim the excess too, though you may need to pursue it through court if the debtor won't pay it voluntarily.",
  },
  {
    q: "Do debt collection agencies have special legal powers?",
    a: "No. A debt collection agency has exactly the same legal standing as you: they can write, email, and phone on your behalf, and that's it. Their effectiveness comes from persistence, credit-control experience, and the psychological weight of a third party getting involved. If the debtor still refuses to pay, the route to actual enforcement runs through the courts — for the agency just as it would for you.",
  },
]

export default function DebtCollectionAgencyVsDiy({ onBack, onGetStarted }) {
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
        { href: "/guides/client-not-paying-invoice", title: "Client not paying your invoice? What to do, step by step", desc: "The full escalation path from first reminder to recovery, in order." },
        { href: "/guides/letter-before-action", title: "Letter Before Action for an unpaid invoice", desc: "The single most effective document in debt recovery — and how to write one." },
        { href: "/guides/small-claims-court-unpaid-invoice", title: "Taking an unpaid invoice to small claims court", desc: "What MCOL costs, how long it takes, and when it's worth it." },
      ]}
    >
      <h2>The uncomfortable truth first</h2>
      <p>
        Searches for "debt collection agency" spike when an invoice hits three or four months overdue. By that point, the debt has usually been chased twice, half-heartedly, with long silences in between — and the steps that would have recovered it cheaply and early were skipped. That's not a criticism; chasing money is miserable, and most freelancers avoid it for entirely human reasons.
      </p>
      <p>
        But it matters, because <strong>the older a debt gets, the harder and more expensive it is to recover</strong>. Credit-control professionals consistently report that collectability falls away sharply once an invoice passes 90 days overdue, and keeps falling from there. The right question isn't really "which agency should I use?" — it's "which option fits the age and state of this particular debt?" Here are the four real options.
      </p>

      <h2>Option 1: Chase it yourself (DIY)</h2>
      <p>
        Free in cash terms, and genuinely effective in the first month or two. A structured sequence of reminders — polite at first, then firm, citing the Late Payment Act and adding statutory interest at {getRate()}% p.a. plus the fixed recovery sum — recovers the large majority of late invoices without any third party getting involved. The full sequence is in our <a href="/guides/how-to-chase-late-invoices">chasing playbook</a>.
      </p>
      <p>
        The cost is time and emotional energy, and that's where DIY usually breaks down. Chasing works through consistency: a reminder every few days, each one escalating slightly, until paying becomes easier than not paying. In practice most people chase inconsistently — a flurry of emails, then three weeks of awkward silence, then an angry one. Inconsistent chasing teaches the client that ignoring you works.
      </p>
      <div className={s.callout}>
        <p>
          If you can chase on a fixed schedule and hold your nerve, DIY is the cheapest option there is. If you know yourself well enough to know you won't, plan for that honestly — it's the most common reason debts age into agency territory.
        </p>
      </div>

      <h2>Option 2: A debt collection agency</h2>
      <p>
        A commercial debt collection agency takes over the chasing for you: letters on their letterhead, phone calls, and persistence from people who do this all day. The involvement of a third party has real psychological weight — debtors who've ignored you for months often pay an agency's first letter.
      </p>

      <h3>What they charge</h3>
      <p>
        Most work on a no-win-no-fee commission — typically around <strong>8–20% of the sums they recover</strong>, though quotes range from roughly 5% for large, recent debts to 25% or more for old, small, or messy ones. Some charge fixed fees instead, particularly for single-letter services. Read the contract carefully: "no win, no fee" sometimes sits alongside admin, instruction, or tracing charges that apply regardless of outcome.
      </p>

      <h3>What they can — and can't — do</h3>
      <p>
        This is the part the industry doesn't advertise: <strong>a debt collection agency has no special legal powers</strong>. They cannot enter premises, seize goods, or compel payment. They write letters and make phone calls — exactly what you can do, done more persistently and with more practised pressure. If the debtor simply refuses, the escalation path still ends at court, where the agency needs a judgment just like you would. What you're buying is persistence, experience, and distance — which is often worth paying for, but it isn't enforcement.
      </p>

      <h3>When an agency genuinely makes sense</h3>
      <ul>
        <li><strong>Old debts (90+ days)</strong> where your own chasing has been exhausted</li>
        <li><strong>A debtor who's gone completely quiet</strong> — agencies can trace companies and directors who've moved on</li>
        <li><strong>You can't face the conflict</strong> — outsourcing the confrontation is a legitimate reason</li>
        <li><strong>Multiple debtors at once</strong> — if late payment is a pattern across your client base, an agency (or a credit-control process) scales better than your evenings</li>
      </ul>

      <h3>Red flags when choosing one</h3>
      <ul>
        <li><strong>Upfront fees for "instruction" or "registration"</strong> before any work happens — reputable commercial agencies earn from recovery</li>
        <li><strong>Pressure tactics</strong> — threats of bailiffs without a judgment, contacting your client's customers, or anything that could rebound on your own reputation</li>
        <li><strong>No accreditation.</strong> For consumer debts, FCA authorisation is essential. B2B collection is lighter-touch regulated, so look instead for Credit Services Association (CSA) membership or staff accredited by the Chartered Institute of Credit Management (CICM) — both bind members to a code of practice</li>
        <li><strong>Vague answers about disputed debts.</strong> A serious agency will ask whether the debt is disputed before quoting; one that doesn't care is planning to bludgeon, not collect</li>
      </ul>

      <h2>Option 3: A solicitor's letter, then court</h2>
      <p>
        A formal <a href="/guides/letter-before-action">Letter Before Action</a> is the required pre-court step anyway, and you can buy it cheaply: fixed-fee LBA services run from around £5–£50 for a template letter on legal letterhead, up to a few hundred pounds for one drafted and signed by a solicitors' firm. For many debtors, a letter from a law firm lands harder than one from a collection agency — it signals court is genuinely next.
      </p>
      <p>
        If the letter expires unanswered, <a href="/guides/small-claims-court-unpaid-invoice">Money Claim Online</a> handles straightforward debts under £10,000 for a modest issue fee, and undefended B2B invoice claims succeed at a very high rate. The combination of fixed-fee LBA plus MCOL is usually cheaper than an agency commission on anything over about £1,000 — provided the debt isn't disputed and the debtor is still solvent and findable.
      </p>

      <h2>Option 4: Automate the chase before it gets that far</h2>
      <p>
        The fourth option isn't really an alternative to an agency — it's what makes agencies unnecessary. Automated chasing tools (Hielda is one) run the entire DIY sequence on a fixed schedule: reminders before the due date, a firm chase the day after, statutory interest at {getRate()}% p.a. and the fixed recovery sum applied automatically from day one, and steady escalation through to a Letter Before Action — without you drafting a single email or having to feel anything about it.
      </p>
      <p>
        The honest way to frame it: <strong>automation is prevention; agencies are cure</strong>. An agency earns its 8–20% rescuing debts that have already aged past the point where polite pressure works. Automation exists to stop invoices reaching that point — and because collectability drops steeply after 90 days, a chase that starts on day one is operating when recovery odds are at their highest. It also fixes the discipline problem from Option 1: the schedule holds whether or not you're dreading the conversation.
      </p>
      <div className={s.calloutGrey}>
        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "#475569" }}>
          Automation won't recover a two-year-old debt from a dissolved company, and it won't trace a debtor who's vanished. For those, you genuinely need an agency or a solicitor. Its job is to make sure your <em>next</em> invoice never becomes that debt.
        </p>
      </div>

      <h2>The options side by side</h2>
      <div className={s.workedExample}>
        <h3>Cost, speed, and trade-offs at a glance</h3>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 0", borderBottom: "1px solid #dce1e8", fontSize: 13 }}>Option</th>
              <th style={{ textAlign: "left", padding: "8px 0", borderBottom: "1px solid #dce1e8", fontSize: 13 }}>Cost</th>
              <th style={{ textAlign: "left", padding: "8px 0", borderBottom: "1px solid #dce1e8", fontSize: 13 }}>Best for</th>
              <th style={{ textAlign: "left", padding: "8px 0", borderBottom: "1px solid #dce1e8", fontSize: 13 }}>Speed</th>
              <th style={{ textAlign: "left", padding: "8px 0", borderBottom: "1px solid #dce1e8", fontSize: 13 }}>Relationship impact</th>
              <th style={{ textAlign: "left", padding: "8px 0", borderBottom: "1px solid #dce1e8", fontSize: 13 }}>Legal power</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>DIY chasing</strong></td>
              <td>Free (your time)</td>
              <td>Invoices under ~60 days late</td>
              <td>Fast if consistent</td>
              <td>Low, if professional</td>
              <td>None — court is the backstop</td>
            </tr>
            <tr>
              <td><strong>Collection agency</strong></td>
              <td>Typically 8–20% of recovered sum</td>
              <td>Old, quiet, or multiple debts</td>
              <td>Weeks to months</td>
              <td>High — usually ends it</td>
              <td>None — letters and calls only</td>
            </tr>
            <tr>
              <td><strong>Solicitor / MCOL</strong></td>
              <td>~£5–£300 letter, plus court fee</td>
              <td>Clear debts, debtor solvent</td>
              <td>14-day LBA window, then weeks</td>
              <td>High</td>
              <td>Real — ends in a judgment</td>
            </tr>
            <tr>
              <td><strong>Automation</strong></td>
              <td>Flat subscription</td>
              <td>Every invoice, from day one</td>
              <td>Immediate and continuous</td>
              <td>Low — reads as accounts admin</td>
              <td>Statutory charges under the Act</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Agency commission ranges and letter fees are typical market figures and vary by provider, debt age, and value — always confirm before instructing.
        </p>
      </div>

      <h2>The decision in one paragraph</h2>
      <p>
        <strong>Under 30 days late:</strong> chase it yourself on a fixed schedule, or automate it — an agency at this stage is paying 8–20% for emails you could send for free. <strong>30–90 days late:</strong> send a Letter Before Action, wait out the 14 days, then issue through Money Claim Online; for clean debts this is faster and cheaper than commission. <strong>90+ days late, or the debtor has gone evasive:</strong> now an agency earns its fee — or be honest with yourself about writing it off and tightening terms for next time. <strong>Disputed work:</strong> resolve the dispute first, in writing, whatever its age — no reputable agency will take a disputed debt, and a court will want to see you tried. And whichever route this invoice takes, set up your <em>next</em> invoice so it never gets here: statutory interest and the fixed sum applied from the first overdue day, on a schedule that doesn't depend on your willpower.
      </p>
    </GuideLayout>
  )
}
