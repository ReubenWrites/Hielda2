import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import LetterBlock from "./LetterBlock"
import { comparisonSchema } from "./comparisonSchema"
import s from "./guides.module.css"

const TITLE = "Final demand letter template (UK): free to copy, with statutory interest"
const LEDE = "A final demand is the last letter you send before formal action. Here are two to copy: a formal final demand with the statutory interest and recovery costs set out, and a strong but civil version for a client you would like to keep. Plus what the letter must say, the deadline to give, and what to do when it passes."
const CANONICAL = "/guides/final-demand-letter-template"

const PAYMENT_DETAILS = `Account name: [Your account name]
Sort code: [00-00-00]
Account number: [00000000]
Reference: [Invoice number]`

const finalDemand = (rate) => `[Your business name]
[Your address]

[Date]

[Client company name]
[Client address]

By email and first class post

Dear [Name],

FINAL DEMAND
Invoice [number] for [£amount], due [due date]

Despite my reminders of [date] and [date], the invoice above remains unpaid. It is now [X] days overdue.

Under the Late Payment of Commercial Debts (Interest) Act 1998, statutory interest at 8% above the Bank of England base rate (currently ${rate}% a year) has been accruing daily since the day after the due date. A fixed sum for recovery costs is also payable. The amount now due is:

Invoice [number]: [£amount]
Fixed sum for recovery costs: [£40 / £70 / £100]
Statutory interest to [date]: [£interest]
Total due: [£total]

Interest continues to accrue at [£daily amount] a day until payment is received.

This is my final request for payment. Please pay the total due by [deadline date], which is 7 days from the date of this letter, to:

${PAYMENT_DETAILS}

If I have not received payment in full by [deadline date], I will send a formal Letter Before Action and then issue a claim in the County Court without further reminder. A claim would add the court fee and further interest to the amount you owe. A County Court judgment that is not paid within one month is entered on the public register of judgments, where it can affect your ability to obtain credit.

If you believe that this sum is not owed, tell me in writing, with your reasons, by the same date.

Yours sincerely,

[Your name]
[Your business name]
[Phone number]`

const STRONG_POLITE = `Subject: Final reminder: invoice [number], [£amount]

Dear [Name],

I have asked for payment of invoice [number] on [date] and again on [date]. It was due on [due date] and is now [X] days overdue.

I value working with you, and I would much prefer to settle this between us. But I cannot leave the invoice unpaid any longer, so I want to be clear about what happens next.

If [£amount] reaches my account by [date, 7 days from today], I will take no further action. I will also not add the statutory interest and recovery costs that I am entitled to under the Late Payment of Commercial Debts (Interest) Act 1998.

If it does not, I will add those charges, which currently come to [£charges], and begin formal recovery of the full amount.

If something is preventing payment, please call me on [phone number] today. A part payment now and a firm date for the balance is better for both of us than silence.

${PAYMENT_DETAILS}

Yours sincerely,
[Your name]
[Your business name]`

const FAQS = [
  { q: "What is a final demand letter?", a: "It is the last informal request for payment of a debt. It states what is owed, sets a short deadline, usually 7 days, and says what you will do if the deadline is missed. It has no special legal status, but it shows a court that you gave the debtor every chance to pay, and it is very often the letter that gets the invoice paid." },
  { q: "Is a final demand the same as a statutory demand?", a: "No, and the two should not be confused. A statutory demand is a prescribed insolvency form that can lead to a winding-up or bankruptcy petition. It only applies above set thresholds (more than £750 owed by a company, £5,000 or more by an individual) and misusing it for a disputed debt can cost you. A final demand is an ordinary letter." },
  { q: "Is a final demand the same as a Letter Before Action?", a: "Not quite. A final demand is a commercial last warning. A Letter Before Action, also called a letter before claim, is the formal step the courts expect before you issue a claim, and it has rules: 14 days is standard for a company, and 30 days with the official information sheet and reply form if the debtor is an individual or sole trader. Many people send a final demand first and the Letter Before Action if it is ignored." },
  { q: "How long should a final demand give the debtor to pay?", a: "Seven days is standard. Shorter looks unreasonable, and longer invites more delay. Give the deadline as a calendar date, not as 'within 7 days', so there is no argument about when the clock started." },
  { q: "Can I add interest in a final demand if I never mentioned it before?", a: "Yes, for a business customer. The Late Payment of Commercial Debts (Interest) Act 1998 gives you statutory interest at 8% above the Bank of England base rate and a fixed sum of £40, £70 or £100, whether or not your invoice or contract mentioned them. They run from the day after the due date. The Act does not apply to consumer debts." },
  { q: "Can I send a final demand by email?", a: "Yes. Send it by email for speed and a timestamp, and by first class post as well, keeping the free proof of postage from the Post Office counter. If the client is a limited company, post it to the registered office shown on Companies House." },
  { q: "What if they pay the invoice but not the interest and costs?", a: "The charges are still owed, and you can ask for them or claim them separately for up to six years in England and Wales. Whether to pursue a small balance from a client you want to keep is a commercial decision. If you choose to waive it, say so in writing so the account is clearly closed." },
]

export default function FinalDemandLetterTemplate({ onBack, onGetStarted }) {
  const rate = getRate()
  const schema = comparisonSchema({ title: TITLE, lede: LEDE, canonical: CANONICAL, faqs: FAQS })
  // Worked example, at the current rate: £2,400 invoice, 30 days overdue.
  const eg = { amount: 2400, days: 30, fixed: 70 }
  const egInterest = Math.round(eg.amount * (rate / 100) * (eg.days / 365) * 100) / 100
  const egDaily = Math.round(eg.amount * (rate / 100) / 365 * 100) / 100
  const gbp = (n) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
        { href: "/guides/letter-before-action", title: "Letter Before Action: how to write one", desc: "The formal pre-court letter that follows an ignored final demand." },
        { href: "/guides/payment-reminder-letter-template", title: "Payment reminder letter templates", desc: "The two polite chasing letters to send before a final demand." },
        { href: "/guides/overdue-invoice-letter-templates", title: "Overdue invoice letters: 30, 60 and 90 days", desc: "A letter for each stage of a long-overdue invoice." },
      ]}
    >
      <ul className={s.jump}>
        <li><a href="#final-demand">Formal final demand</a></li>
        <li><a href="#strong-polite">Strong but civil version</a></li>
      </ul>

      <h2>What a final demand is, and what it is not</h2>
      <p>
        A final demand, or letter of final demand, is the last ordinary request for payment before you take formal steps. It says three things: what is owed, the date by which it must be paid, and what you will do if it is not. Nothing more is needed, and nothing in it has to sound like a solicitor wrote it.
      </p>
      <p>
        It is not a <strong>statutory demand</strong>, which is a prescribed insolvency form with thresholds and risks of its own. It is also not quite a <a href="/guides/letter-before-action">Letter Before Action</a>, the formal letter the courts expect before a claim is issued. Think of it as the step in between: firmer than a reminder, less formal than a letter of claim.
      </p>

      <h2>When to send it</h2>
      <p>
        Send a final demand when two <a href="/guides/payment-reminder-letter-template">payment reminders</a> have been ignored, or answered with promises that were not kept. That is usually three to four weeks after the due date. There is no rule that you must wait that long, and no benefit in waiting longer.
      </p>
      <p>
        One exception. If the client has raised a specific, genuine dispute about the work, answer the dispute first. A final demand that ignores an open query reads badly if anyone else ever has to look at the file.
      </p>

      <h2>Formal final demand letter</h2>
      <p>
        This version is for a business client. It sets out the debt with the statutory interest and the fixed recovery sum added, gives a 7-day deadline and states the next two steps. Fill in the brackets and send it by email and post.
      </p>
      <LetterBlock
        id="final-demand"
        title="Final demand letter for an unpaid invoice"
        text={finalDemand(rate)}
        note="The fixed sum is £40 for a debt under £1,000, £70 from £1,000 to £9,999.99 and £100 for £10,000 or more."
      />

      <div className={s.workedExample}>
        <h3>Worked example: £2,400 invoice, 30 days overdue</h3>
        <table>
          <tbody>
            <tr><td>Invoice</td><td>{gbp(eg.amount)}</td></tr>
            <tr><td>Fixed sum for recovery costs</td><td>+ {gbp(eg.fixed)}</td></tr>
            <tr><td>Statutory interest ({eg.days} days at {rate}% a year)</td><td>+ {gbp(egInterest)}</td></tr>
            <tr><td><strong>Total due</strong></td><td>{gbp(eg.amount + eg.fixed + egInterest)}</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Interest then adds about {gbp(egDaily)} a day. The <a href="/calculator">calculator</a> works out the figures for your own invoice, and the <a href="/late-payment-letter-template">letter generator</a> drops them into a letter.
        </p>
      </div>

      <h2>A strong letter that keeps the relationship</h2>
      <p>
        Sometimes the client is one you want to work with again, and a formal demand feels like more than the situation needs. This version is just as clear about the deadline, but it leaves the charges off if they pay on time and offers a way to talk. It works well as an email.
      </p>
      <LetterBlock
        id="strong-polite"
        title="Strong but civil final reminder"
        text={STRONG_POLITE}
        note="Use this once. If the date passes, send the formal final demand with the charges added, as you said you would."
      />

      <h2>What a final demand must include</h2>
      <ul>
        <li><strong>The words "final demand"</strong> in the heading, so the status of the letter is not in doubt.</li>
        <li><strong>The invoice number, original amount and due date.</strong></li>
        <li><strong>A breakdown of the total</strong>: the invoice, the fixed sum and the interest to date, each on its own line, with the daily rate at which interest keeps running.</li>
        <li><strong>The legal basis for the charges</strong>, which for business debts is the Late Payment of Commercial Debts (Interest) Act 1998.</li>
        <li><strong>A deadline given as a date.</strong> Seven days is standard.</li>
        <li><strong>How to pay</strong>, in the letter itself.</li>
        <li><strong>The consequence</strong>: the specific next step you will take, stated plainly and only if you are prepared to take it.</li>
      </ul>

      <h2>Mistakes that weaken a final demand</h2>
      <ul>
        <li><strong>Threats you will not carry out.</strong> If you say court proceedings will follow, be ready to start them. A second "final" demand tells the debtor the first was a bluff.</li>
        <li><strong>Threats that have nothing to do with the debt.</strong> Say what legal step comes next and stop there. Threatening to tell their customers, post reviews or turn up at their office can amount to unlawful harassment of a debtor, and it damages your position if the matter reaches a judge.</li>
        <li><strong>Vague wording.</strong> "We may consider further action" asks to be ignored. "I will issue a claim in the County Court" does not.</li>
        <li><strong>Anger.</strong> Write as if a judge will read it, because one might. Dates, amounts and one clear request.</li>
      </ul>

      <h2>After the deadline</h2>
      <p>
        If the money arrives, confirm receipt and close the account. If you get a reply asking for time, agree a payment plan in writing, with dates, and note that interest continues until the balance is cleared.
      </p>
      <p>
        If you get silence, send a <a href="/guides/letter-before-action">Letter Before Action</a>. That is the formal pre-court step, and once its deadline passes you can issue a claim online for debts under £10,000 without a solicitor. Our guide to the <a href="/guides/small-claims-court-unpaid-invoice">small claims court for unpaid invoices</a> covers fees and what to expect.
      </p>
      <p>
        Hielda sends this whole sequence for you: reminders before and after the due date, formal notices with the interest calculated to the day, and a Letter Before Action drafted from the invoice when you decide it is time.
      </p>
    </GuideLayout>
  )
}
