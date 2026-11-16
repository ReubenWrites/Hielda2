import GuideLayout from "./GuideLayout"
import LetterBlock from "./LetterBlock"
import { comparisonSchema } from "./comparisonSchema"
import s from "./guides.module.css"

// /guides/film-tv-invoice-payment-terms
// The prevention guide for crew who invoice: what to agree before day one
// and what goes on the invoice. No claims about what any union agreement or
// broadcaster requires; only the general law and things a freelancer
// controls.

const TITLE = "Invoicing a production: payment terms, POs and deal memos for film and TV crew"
const LEDE = "Most late payments in film and TV are decided before the first day of the shoot: no terms agreed, no PO number, the wrong company name on the invoice. Here is what to settle in advance and what to put on the invoice so that accounts can pay it the first time they see it."
const CANONICAL = "/guides/film-tv-invoice-payment-terms"

const BOOKING_EMAIL = `Subject: [Production title]: confirming my booking, [dates]

Hi [Name],

Thanks for the booking. To confirm what we agreed:

Role: [role]
Dates: [start date] to [end date]
Rate: [£amount] per [day / week], based on a [10]-hour day
Overtime: [£amount] per hour after [10] hours
Kit: [£amount] per [day / week] for [kit description]
Travel and expenses: [what was agreed]
Payment terms: invoice paid within [14 / 30] days

Could you also let me know:

1. the full name of the company I should invoice,
2. the PO or job number to quote, and
3. the email address invoices should go to?

If I have any of this wrong, please tell me before [start date].

Thanks,
[Your name]
[Phone number]`

const INVOICE_CLAUSE = `Payment terms: [14 / 30] days from the date of this invoice. Payment due by [due date].

If this invoice is paid late, statutory interest at 8% above the Bank of England base rate and a fixed sum for recovery costs will be charged under the Late Payment of Commercial Debts (Interest) Act 1998.`

const FAQS = [
  { q: "What payment terms should film and TV freelancers ask for?", a: "Thirty days is the most common and is also the legal default when nothing is agreed. Fourteen days is a reasonable request for dailies and short jobs, and for anything involving significant kit or expenses you have paid for up front. Whatever you agree, get it in writing before you start, even if that is one line in an email." },
  { q: "Can a production insist on 60 or 90 day payment terms?", a: "It can propose them, and if you accept, they are the terms. But between businesses, terms longer than 60 days are only valid if they are not grossly unfair to the supplier. Terms that long are worth querying before you take the job, when you still have something to bargain with." },
  { q: "Do I need a PO number on my invoice?", a: "If the production uses purchase orders, yes. An invoice without the PO number often cannot be matched or approved, and nobody will necessarily tell you. Ask for the PO or job number when you are booked, not when you invoice." },
  { q: "I started the job without a deal memo. Do I still have a contract?", a: "Yes. A contract does not need a signed document. Emails, texts, the call sheet and the fact that you turned up and worked all show what was agreed. Send a short confirmation email now, setting out the rate, dates and payment terms as you understand them. If nobody corrects it, that email is strong evidence." },
  { q: "Should I invoice weekly or at the end of the job?", a: "On anything longer than a week or two, invoice weekly or fortnightly if the production will accept it. It keeps the amounts smaller, starts each payment clock earlier and means a problem shows up after one unpaid week, not after six." },
  { q: "Am I self-employed or on the payroll?", a: "The production decides when it engages you, based on HMRC's rules for the role and the engagement. If you are paid through payroll you will fill in timesheets, not send invoices, and the rules in this guide do not apply. If you invoice as a sole trader or through your own company, they do." },
]

export default function FilmTvInvoicePaymentTerms({ onBack, onGetStarted }) {
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
        { href: "/guides/production-company-not-paying-invoice", title: "Production company not paying?", desc: "What to do when the invoice is already late: who to chase, what to check and what the law adds." },
        { href: "/film-tv-freelancers", title: "Hielda for film and TV freelancers", desc: "Invoices with day rates, kit and PO numbers, chased automatically if they go overdue." },
        { href: "/guides/invoice-payment-terms-uk", title: "Invoice payment terms in the UK", desc: "The general rules on 30, 14 and 7 day terms for any freelancer." },
      ]}
    >
      <h2>Before day one: get four things in writing</h2>
      <p>
        Film and TV bookings are often made by phone or text, days before the job, by someone with forty other positions to fill. That is fine. But before you start, put the deal in an email. It does not need to be a contract. It needs to be something you can point to when accounts ask what was agreed.
      </p>
      <ul>
        <li><strong>Your rate and what it covers.</strong> Day or week, the length of the working day, overtime, kit, travel and per diems.</li>
        <li><strong>The payment terms.</strong> How many days after your invoice you will be paid.</li>
        <li><strong>Who is paying you.</strong> The full legal name of the company.</li>
        <li><strong>How to invoice.</strong> The PO or job number and the address invoices go to.</li>
      </ul>
      <p>
        If the production sends a deal memo, check it says all four. If it does not send one, send this.
      </p>
      <LetterBlock
        id="booking-confirmation"
        title="Booking confirmation email"
        text={BOOKING_EMAIL}
        note="If nobody corrects it, this email is your record of what was agreed."
      />

      <h2>Know which company you are working for</h2>
      <p>
        Productions are commonly made through a company set up for that one film or series. The name on the call sheet, the name of the well-known producer and the name of the company that owes you money can be three different things.
      </p>
      <p>
        It matters for two reasons. Accounts may reject an invoice addressed to the wrong entity. And if the invoice is not paid, the company named on your deal memo is the one you chase and, if it comes to it, the one you claim against. Look it up on Companies House before you start. An active company with a filing history is a better sign than one registered last month, though for a new production that is normal.
      </p>

      <h2>Payment terms: what is normal and what the law says</h2>
      <p>
        Thirty days from invoice is the usual term. Some productions pay on fixed weekly or fortnightly runs, which can be quicker. Others will propose 45 or 60 days.
      </p>
      <ul>
        <li><strong>If nothing is agreed</strong>, the law sets a default of 30 days.</li>
        <li><strong>If more than 60 days is proposed</strong>, the term is only valid between businesses if it is not grossly unfair to you.</li>
        <li><strong>If you want shorter terms</strong>, ask when you are booked. Fourteen days is a fair request for dailies, and for jobs where you are paying for kit or travel up front.</li>
      </ul>
      <p>
        Whatever the term, an invoice paid after it is late, and the <a href="/guides/late-payment-act-1998-explained">Late Payment Act</a> then adds interest and a fixed sum. Our general guide to <a href="/guides/invoice-payment-terms-uk">invoice payment terms</a> covers the rules in more detail.
      </p>

      <h2>PO numbers and supplier forms</h2>
      <p>
        Larger productions and broadcasters' in-house teams often cannot pay an invoice until two things exist: a purchase order for your engagement and a supplier record with your bank details. Neither is your job to create, but both are your problem if they are missing.
      </p>
      <p>
        So ask at booking: is there a PO, do you need a supplier form from me, and is there a cut-off day for the payment run? Filling in a supplier form in week one is a small chore. Finding out in week six that you were never set up is a month's delay.
      </p>

      <h2>What to put on the invoice</h2>
      <ul>
        <li><strong>Your name or business name</strong>, address and contact details.</li>
        <li><strong>The production company's full legal name</strong> and address, as on the deal memo.</li>
        <li><strong>An invoice number and date.</strong></li>
        <li><strong>The production title and the PO or job number</strong>, at the top, where accounts look first.</li>
        <li><strong>Your role and the dates worked.</strong></li>
        <li><strong>Each charge on its own line</strong>: days at your rate, overtime, kit hire, mileage and expenses. One total with no breakdown is the invoice that gets queried.</li>
        <li><strong>Receipts</strong> for any expenses, attached.</li>
        <li><strong>VAT</strong>, with your VAT number, if you are VAT registered. If you are not, do not add it.</li>
        <li><strong>Your bank details.</strong></li>
        <li><strong>The payment terms and the due date</strong> as an actual date.</li>
        <li><strong>A late payment line</strong>, like the one below.</li>
      </ul>
      <LetterBlock
        id="invoice-clause"
        title="Payment terms wording for your invoice"
        text={INVOICE_CLAUSE}
        copyLabel="Copy wording"
        note="You are entitled to these charges even without this line. It is there so that nobody is surprised."
      />
      <p>
        The <a href="/free-invoice-template-uk">free UK invoice template</a> has all of this laid out and downloads as a PDF.
      </p>

      <h2>When to invoice</h2>
      <ul>
        <li><strong>On wrap day, not the week after.</strong> The payment clock starts when the invoice is sent. Every day you wait is a day added to the terms.</li>
        <li><strong>Weekly on long jobs</strong>, if the production allows it. Smaller invoices are approved faster, and you find out early if there is a problem.</li>
        <li><strong>Before the office closes.</strong> After wrap, the people who can approve your invoice start leaving. An invoice sent while the production accountant is still at their desk is far more likely to be paid on time.</li>
      </ul>

      <h2>If it still goes overdue</h2>
      <p>
        Send a reminder the day after the due date. It is routine, and accounts departments expect it. Our guide to a <a href="/guides/production-company-not-paying-invoice">production company not paying</a> sets out the steps from there.
      </p>
      <div className={s.callout}>
        <p>
          Hielda builds the invoice with your day rates, kit and PO number on it, then chases it for you if it goes overdue, adding the interest and fixed sum the law allows. See <a href="/film-tv-freelancers">Hielda for film and TV freelancers</a>.
        </p>
      </div>
    </GuideLayout>
  )
}
