import GuideLayout from "./GuideLayout"
import LetterBlock from "./LetterBlock"
import { comparisonSchema } from "./comparisonSchema"
import s from "./guides.module.css"

const TITLE = "Payment reminder letter templates (UK): polite chasing letters that get invoices paid"
const LEDE = "Three chasing letters to copy and send: a friendly first reminder, a firmer second one that mentions the Late Payment Act, and a short note for the accounts department when your contact says it is out of their hands. Each is written to be answered, not filed."
const CANONICAL = "/guides/payment-reminder-letter-template"

const PAYMENT_DETAILS = `Payment details
Account name: [Your account name]
Sort code: [00-00-00]
Account number: [00000000]
Reference: [Invoice number]`

const FIRST_REMINDER = `Subject: Invoice [number]: payment reminder

Dear [Name],

I hope you are well. This is a quick reminder that invoice [number] for [£amount], dated [invoice date], was due for payment on [due date] and does not appear to have been paid yet.

A copy of the invoice is attached. If payment has already been sent, please ignore this message and accept my thanks.

If there is a query on the invoice, or anything you need from me to process it (a purchase order number, for example), please let me know and I will sort it out straight away.

${PAYMENT_DETAILS}

Kind regards,
[Your name]
[Your business name]
[Phone number]`

const SECOND_REMINDER = `Subject: Invoice [number]: now [X] days overdue

Dear [Name],

I am writing again about invoice [number] for [£amount], which was due on [due date] and is now [X] days overdue. I sent a reminder on [date of first reminder] and have had neither payment nor a reply.

Please arrange payment within 7 days, by [date].

As you may know, the Late Payment of Commercial Debts (Interest) Act 1998 entitles a supplier to statutory interest at 8% above the Bank of England base rate, and to a fixed sum for recovery costs, on any invoice that is paid late. I would rather not add these charges, and I will not do so if payment reaches me by the date above.

If there is a problem with the invoice or a reason for the delay, please tell me today so that we can resolve it.

${PAYMENT_DETAILS}

Yours sincerely,
[Your name]
[Your business name]
[Phone number]`

const ACCOUNTS_NOTE = `Subject: Invoice [number] to [client company]: payment date, please

Dear Accounts team,

Invoice [number] for [£amount] was due on [due date]. [Contact name] has confirmed that the work was delivered and approved, and has asked me to contact you directly.

Could you confirm by reply:

1. that the invoice is on your system and approved for payment, and
2. the date of the payment run it will be included in?

If anything is missing, such as a purchase order number, a new supplier form or bank verification, please tell me what you need and I will send it today.

A copy of the invoice is attached.

Kind regards,
[Your name]
[Your business name]
[Phone number]`

const FAQS = [
  { q: "How soon after the due date should I send a payment reminder?", a: "The day after. An invoice is late from the first day past its due date, and a short, friendly reminder on day one is normal credit control, not rudeness. Waiting a fortnight to seem polite teaches the client that your due dates are flexible." },
  { q: "How many reminders should I send before a final demand?", a: "Two is enough: a friendly one in the first week and a firmer one at around 14 days. If both are ignored, a third reminder in the same tone adds nothing. Move to a final demand, which sets a deadline and states the consequences." },
  { q: "Should a payment reminder mention late payment interest?", a: "Not the first one, which should assume an oversight. The second should mention it. For business-to-business invoices in the UK, the Late Payment of Commercial Debts (Interest) Act 1998 gives you statutory interest at 8% above the Bank of England base rate plus a fixed sum of £40, £70 or £100, and naming that right is often what moves an invoice up the payment list." },
  { q: "Can I charge interest if my invoice or contract did not mention it?", a: "Yes, for business customers. The right comes from the Act, not from your paperwork, so it applies even if your invoice said nothing about late payment. It does not apply to invoices to consumers: there you can only charge interest that the customer agreed to in advance." },
  { q: "Is an email reminder enough, or should I post a letter?", a: "Email is fine for reminders and is what most accounts departments expect. Send it to the person who commissioned the work and copy in the accounts address. Keep post for the final demand and the Letter Before Action, where proof of delivery starts to matter." },
  { q: "What is the difference between a chasing letter and a final demand?", a: "A chasing letter, or payment reminder, asks for payment and assumes good faith. A final demand says this is the last request, sets a short deadline and states what happens if it is missed. Use reminders first, because most late invoices are admin problems rather than refusals." },
]

export default function PaymentReminderLetterTemplate({ onBack, onGetStarted }) {
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
        { href: "/guides/final-demand-letter-template", title: "Final demand letter template", desc: "The next letter if both reminders are ignored: a deadline, the statutory charges and what happens next." },
        { href: "/guides/overdue-invoice-letter-templates", title: "Overdue invoice letters: 30, 60 and 90 days", desc: "A letter for each stage of a long-overdue invoice, with what the debt is worth by then." },
        { href: "/guides/how-to-chase-late-invoices", title: "How to chase late invoices", desc: "The full day-by-day sequence these letters belong to." },
      ]}
    >
      <ul className={s.jump}>
        <li><a href="#first-reminder">First reminder</a></li>
        <li><a href="#second-reminder">Second reminder</a></li>
        <li><a href="#accounts-note">Note to accounts</a></li>
      </ul>

      <h2>Which letter to send, and when</h2>
      <p>
        Most late invoices are not refusals to pay. They are invoices sitting in an approval queue, missing a purchase order number, or sent to someone who has left. A chasing letter has one job, which is to find out which of those it is and get the invoice moving. That is why the first reminder is friendly and the second is firm. If neither works, you are no longer dealing with an oversight.
      </p>
      <table className={s.timeline}>
        <thead>
          <tr><th>When</th><th>Send</th><th>Tone</th></tr>
        </thead>
        <tbody>
          <tr><td>1 to 7 days overdue</td><td>First reminder</td><td>Friendly. Assumes it was missed.</td></tr>
          <tr><td>Any time</td><td>Note to accounts</td><td>Practical. Asks for a payment date.</td></tr>
          <tr><td>14 days overdue</td><td>Second reminder</td><td>Firm. Sets a date and mentions the Act.</td></tr>
          <tr><td>21 to 30 days overdue</td><td><a href="/guides/final-demand-letter-template">Final demand</a></td><td>Formal. Deadline and consequences.</td></tr>
        </tbody>
      </table>

      <h2>First payment reminder: friendly</h2>
      <p>
        Send this in the first week after the due date. It gives the client an easy way to fix an honest mistake, and it asks the one question that unblocks most invoices: is there anything you need from me?
      </p>
      <LetterBlock
        id="first-reminder"
        title="First payment reminder (1 to 7 days overdue)"
        text={FIRST_REMINDER}
        note="Attach the invoice again as a PDF. Do not make them look for it."
      />

      <h2>Second payment reminder: firm</h2>
      <p>
        Send this at around 14 days overdue if the first reminder brought no payment and no reply. Three things change. It states how late the invoice is, it sets a calendar date, and it tells the client what the law allows you to add. For a business customer that is statutory interest at 8% above the Bank of England base rate plus a fixed sum of £40, £70 or £100, depending on the size of the invoice. The <a href="/calculator">late payment calculator</a> shows the figure for your invoice.
      </p>
      <LetterBlock
        id="second-reminder"
        title="Second payment reminder (about 14 days overdue)"
        text={SECOND_REMINDER}
        note="Only offer to waive the charges if you mean it. If the date passes, add them and say so in your next letter."
      />
      <div className={s.callout}>
        <p>
          <strong>Invoicing a consumer, not a business?</strong> Delete the paragraph about the Act. It covers business-to-business debts only. You can still ask firmly for payment by a set date.
        </p>
      </div>

      <h2>Note to the accounts department</h2>
      <p>
        "It's with accounts" is the most common reply to a reminder. Do not wait for your contact to chase it for you. Ask them for the accounts email address, then send this. It asks two closed questions that are hard to answer vaguely, and it removes the usual excuses in advance.
      </p>
      <LetterBlock
        id="accounts-note"
        title="Note to the accounts department"
        text={ACCOUNTS_NOTE}
        note="Copy in the person who commissioned the work, so both sides can see the question has been asked."
      />

      <h2>What every payment reminder needs</h2>
      <ul>
        <li><strong>The invoice number, amount and due date</strong> in the first two lines, so nobody has to open an attachment to know what this is about.</li>
        <li><strong>How to pay.</strong> Bank details in the body of the email, every time.</li>
        <li><strong>The invoice attached again.</strong> "Can you resend it?" is a week's delay you can avoid.</li>
        <li><strong>One clear request.</strong> Pay by a date, or tell me what is in the way. Not both buried in three paragraphs.</li>
        <li><strong>A named person to reply to</strong>, with a phone number. Some problems are solved faster by a two-minute call.</li>
      </ul>

      <h2>Getting the tone right</h2>
      <p>
        A good chasing letter reads as if it came from an accounts department, even if the accounts department is you at the kitchen table. Keep it short. State facts and dates. Leave out how long you have waited, how disappointed you are and how small your business is. None of that gets an invoice approved, and it gives the reader something to respond to other than the request for payment.
      </p>
      <p>
        Do not apologise for asking. "Sorry to chase" tells the client the invoice is optional. "This is a reminder that invoice 104 was due on 3 March" does not.
      </p>

      <h2>If the reminders are ignored</h2>
      <p>
        Two unanswered reminders is your signal to stop reminding. The next step is a <a href="/guides/final-demand-letter-template">final demand</a> with the statutory charges added, then a <a href="/guides/letter-before-action">Letter Before Action</a>. If the invoice is already a month or more late, the <a href="/guides/overdue-invoice-letter-templates">30, 60 and 90 day letters</a> pick up from where you are.
      </p>
      <p>
        If you would rather not write any of this by hand, the <a href="/late-payment-letter-template">letter generator</a> fills in a formal demand with your figures. Hielda goes further and sends the whole sequence for you, reminders first and formal notices after, with the interest worked out to the day.
      </p>
    </GuideLayout>
  )
}
