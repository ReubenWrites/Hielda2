import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import CompareTable from "./CompareTable"
import { comparisonSchema, HIELDA_PRICE, HIELDA_TRIAL } from "./comparisonSchema"
import s from "./guides.module.css"

const TITLE = "Hielda vs Xero, QuickBooks and FreeAgent invoice reminders"
const LEDE = "Your accounting software already sends payment reminders, so why would you pay for something else? Because a reminder and a chase are different things. This page sets out what the built-in reminders in Xero, QuickBooks and FreeAgent do, what they leave out, and when Hielda is worth adding."
const CANONICAL = "/guides/hielda-vs-xero-invoice-reminders"

const FAQS = [
  { q: "Does Xero add late payment interest to invoices automatically?", a: "No. Xero's invoice reminders send a fixed set of emails around the due date, but Xero does not calculate or add statutory interest or the fixed recovery cost. The request to add it has sat on Xero's product ideas forum for years, and in 2024 Xero said it had no committed plans to build it. The suggested workaround is to add a line to the invoice manually." },
  { q: "What do accounting software reminders actually send?", a: "Typically a short set of templated emails: one before the due date, one on it, and one or more after, at intervals you choose, each attaching or linking the original invoice. The wording and amount stay the same; the sequence usually stops after the last reminder." },
  { q: "Do I need Hielda if I already use Xero or QuickBooks?", a: "If your clients pay within a reminder or two, no. If invoices routinely go past 30 days, the built-in reminders have done their job and stopped, and that is where Hielda starts: escalating chases with the statutory charges added, a Letter Before Action, and formal monthly reminders until it is paid." },
  { q: "Does Hielda sync with my accounting software?", a: "Not yet. Hielda creates its own invoice, with your bank details and the late payment clause, and sends the PDF to your client. You record the payment in your accounts as you do now. If you need everything to live inside your accounting package, the built-in reminders or a tool such as Chaser may suit you better." },
  { q: "Can I use both?", a: "Yes. Some users keep issuing invoices from their accounting package and add to Hielda only the ones that go late, so the chase sequence, charges and formal letter apply to those. Others issue everything through Hielda for the reminders-before-due and the automatic escalation." },
]

export default function HieldaVsXeroReminders({ onBack, onGetStarted }) {
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
        { href: "/guides/hielda-vs-chaser", title: "Hielda vs Chaser", desc: "If you want credit control that lives inside your accounting system." },
        { href: "/guides/how-much-interest-late-invoice", title: "How much interest can you charge?", desc: "What the reminders are leaving on the table." },
        { href: "/guides/invoice-payment-terms-uk", title: "Invoice payment terms", desc: "Set terms that make reminders bite." },
      ]}
    >
      <h2>A reminder is not a chase</h2>
      <p>
        Built-in reminders are good at one thing: telling a client who forgot. Xero's send around the due date at intervals you set; QuickBooks and FreeAgent offer the same kind of templated sequence. For the client who meant to pay and lost the email, that is all it takes, and it costs nothing extra.
      </p>
      <p>
        They are not designed for the client who read the invoice and decided to pay later. Each reminder asks for the <strong>same amount</strong>, in the <strong>same tone</strong>, and after the last one the software goes quiet. Nothing in the sequence makes delay cost the client anything, which is precisely what the Late Payment of Commercial Debts (Interest) Act 1998 exists to do.
      </p>

      <h2>Hielda vs accounting software reminders at a glance</h2>
      <CompareTable
        colA="Hielda"
        colB="Xero / QuickBooks / FreeAgent reminders"
        rows={[
          { label: "Price", a: HIELDA_PRICE, b: "Included in your subscription" },
          { label: "Reminders before the due date", a: "Five days and one day before", b: true },
          { label: "Reminders after the due date", a: "Days 1, 7, 14, 21, 30, then monthly until paid", b: "A few at set intervals, then stops" },
          { label: "Statutory interest calculated daily and added to each email", a: true, b: false },
          { label: "Fixed recovery cost (£40 / £70 / £100) added", a: true, b: false },
          { label: "Tone escalates from polite to formal", a: true, b: "Same template each time" },
          { label: "Letter Before Action drafted from the invoice", a: true, b: false },
          { label: "Pauses on dispute and tells the client", a: true, b: "Manual" },
          { label: "Part payments credited, interest on the balance", a: true, b: "Reminder shows the balance" },
          { label: "Lives inside your accounting system", a: false, b: true },
          { label: "Bookkeeping, VAT, bank feeds", a: false, b: true },
          { label: "You confirm each email", a: true, b: "Automatic once enabled" },
        ]}
      />
      <p className={s.calloutGrey}>
        Reminder features differ by package and plan and change over time. The claim that none of them adds statutory interest automatically reflects their published features and forums as of October 2026; Xero has said publicly it has no plans to. Check your own package's current settings.
      </p>

      <h2>What the reminders leave on the table</h2>
      <p>
        A £3,000 invoice paid 60 days late has earned about £58 in statutory interest at {getRate()}% a year plus the £70 fixed cost: <strong>£128</strong> the Act says you can add. A reminder sequence that asks for £3,000 five times collects, at best, £3,000. Over a year of invoices that gap is the difference between late payment being free for your clients and being expensive for them, and clients notice which one you are.
      </p>

      <h2>What the accounting software does that Hielda doesn't</h2>
      <p>
        Everything else. Your package is where the bookkeeping, VAT returns, bank feeds and year-end live, and Hielda does not replace any of it. Hielda is one job: getting a late invoice paid with the charges the law allows. If your invoices rarely go late, the built-in reminders are enough and you should keep your money.
      </p>

      <h2>How to decide</h2>
      <div className={s.callout}>
        <p><strong>Stick with the built-in reminders</strong> if a nudge or two is all your clients ever need.</p>
        <p><strong>Add Hielda</strong> if invoices regularly pass 30 days, you have never claimed the interest you are entitled to, or you want someone else to be the one asking. Put one overdue invoice through the <a href="/calculator">calculator</a> first and see what it is actually owed.</p>
      </div>
    </GuideLayout>
  )
}
