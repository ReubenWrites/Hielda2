import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import LetterBlock from "./LetterBlock"
import { comparisonSchema } from "./comparisonSchema"
import s from "./guides.module.css"

const TITLE = "Overdue invoice letter templates: 30, 60 and 90 days past due (UK)"
const LEDE = "A letter for each stage of a long-overdue invoice. At 30 days, a notice that adds the statutory charges. At 60 days, a last notice before legal action. At 90 days, a letter before claim. Each one is ready to copy, with what the debt is worth by then."
const CANONICAL = "/guides/overdue-invoice-letter-templates"

const PAYMENT_DETAILS = `Account name: [Your account name]
Sort code: [00-00-00]
Account number: [00000000]
Reference: [Invoice number]`

const letter30 = (rate) => `Subject: Invoice [number]: 30 days overdue, statutory charges now applied

Dear [Name],

Invoice [number] for [£amount] was due on [due date] and is now 30 days overdue. My reminders of [date] and [date] have not been answered.

As the invoice remains unpaid, I am now applying the charges provided by the Late Payment of Commercial Debts (Interest) Act 1998: statutory interest at 8% above the Bank of England base rate (currently ${rate}% a year) from the day after the due date, and a fixed sum for recovery costs.

Updated amount due
Invoice [number]: [£amount]
Fixed sum for recovery costs: [£40 / £70 / £100]
Statutory interest, 30 days: [£interest]
Total due today: [£total]

Interest continues at [£daily amount] a day.

Please pay the total due within 7 days, by [date], to:

${PAYMENT_DETAILS}

If there is a dispute about the invoice, I need to hear it in writing by the same date. If I hear nothing, I will treat the debt as accepted.

Yours sincerely,
[Your name]
[Your business name]
[Phone number]`

const letter60 = `[Your business name]
[Your address]

[Date]

[Client company name]
[Client address]

By email and first class post

Dear [Name],

LAST NOTICE BEFORE LEGAL ACTION
Invoice [number], due [due date], now 60 days overdue

I wrote to you on [date] setting out the sum due on this invoice, including statutory interest and recovery costs under the Late Payment of Commercial Debts (Interest) Act 1998. I have received neither payment nor any dispute of the debt.

The amount due today is [£total], made up of the invoice of [£amount], a fixed sum of [£40 / £70 / £100] and interest of [£interest]. Interest continues at [£daily amount] a day.

Two months is long enough. Unless the full amount is in my account by [date, 7 days from today], I will begin the formal process of recovering it through the County Court. That will add court fees and further interest to what you owe.

I would still prefer to resolve this directly. If you cannot pay in full, contact me before the date above with a proposal for payment in writing.

${PAYMENT_DETAILS}

Yours sincerely,

[Your name]
[Your business name]
[Phone number]`

const letter90 = `[Your business name]
[Your address]

[Date]

[Client company name]
[Registered office address]

By email and first class post

Dear Sirs,

LETTER BEFORE CLAIM
Invoice [number] dated [invoice date]

I am writing about the debt below, which is now 90 days overdue. This letter is sent in accordance with the Practice Direction on Pre-Action Conduct.

The debt
On [date] I supplied [short description of the work or goods] to [client company name] at an agreed price of [£amount]. Invoice [number] was sent on [invoice date] and fell due on [due date]. It has not been paid and has not been disputed. I sent reminders on [dates] and a last notice on [date].

Amount claimed
Invoice [number]: [£amount]
Fixed sum under the Late Payment of Commercial Debts (Interest) Act 1998: [£40 / £70 / £100]
Statutory interest from [day after due date] to [today's date]: [£interest]
Total: [£total]

Interest continues to accrue at [£daily amount] a day until payment.

What you must do
Pay [£total] by 4pm on [date, 14 days from today] to:

${PAYMENT_DETAILS}

If you dispute the debt, reply in writing by the same date, explaining why and enclosing any documents you rely on.

What happens if you do not
If I have received neither payment nor a written response by that date, I will issue a claim in the County Court without further notice. I will claim the sum above, further interest, the court fee and fixed costs. I will also draw this letter to the court's attention on the question of costs.

Yours faithfully,

[Your name]
[Your business name]
[Phone number]`

const FAQS = [
  { q: "What should a 30 days overdue letter say?", a: "By 30 days the polite reminders are done. The letter should state that the invoice is 30 days overdue, add the statutory interest and the fixed recovery sum under the Late Payment of Commercial Debts (Interest) Act 1998, give the new total, and set a 7-day deadline. It should also ask for any dispute in writing, so that silence cannot later be dressed up as a query." },
  { q: "What is a 90 days past due letter?", a: "In the UK it is usually a letter before claim, also called a Letter Before Action: the formal notice that you will start court proceedings unless the debt is paid by a stated date. 'Past due' is the American phrase; in Britain the same invoice is described as 90 days overdue." },
  { q: "Do I have to wait 90 days before taking legal action?", a: "No. There is no minimum waiting period in UK law. You can send a letter before claim as soon as an invoice is overdue and your reminders have been ignored, and many businesses do so at around 30 days. Waiting longer generally lowers the chance of being paid." },
  { q: "How much interest can I add to an invoice that is 60 or 90 days overdue?", a: "For a business customer, 8% above the Bank of England base rate, calculated daily on the unpaid amount from the day after the due date, plus a one-off fixed sum of £40, £70 or £100 depending on the size of the invoice. The table on this page shows what that comes to on a £2,000 invoice." },
  { q: "The client is a sole trader. Can I use the 90 day letter?", a: "Not as it stands. If the debtor is an individual or a sole trader, the Pre-Action Protocol for Debt Claims applies. You must give 30 days to respond, not 14, and enclose the official information sheet and reply form. The letter on this page is written for a limited company." },
  { q: "Is an old invoice still worth chasing?", a: "Usually, yes. In England and Wales you have six years from the date payment was due to bring a claim, and statutory interest has been running the whole time. The practical difficulty is that the longer a debt is left, the more likely the business has changed hands, run short of money or closed." },
]

export default function OverdueInvoiceLetterTemplates({ onBack, onGetStarted }) {
  const rate = getRate()
  const schema = comparisonSchema({ title: TITLE, lede: LEDE, canonical: CANONICAL, faqs: FAQS })
  const gbp = (n) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  // What a £2,000 invoice is worth at each stage, at the current rate.
  const EG = 2000
  const FIXED = 70
  const interestAt = (days) => Math.round(EG * (rate / 100) * (days / 365) * 100) / 100

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
        { href: "/guides/payment-reminder-letter-template", title: "Payment reminder letter templates", desc: "For invoices under 30 days late: the friendly first reminder and the firmer second one." },
        { href: "/guides/final-demand-letter-template", title: "Final demand letter template", desc: "A standalone final demand, plus a strong but civil version for clients you want to keep." },
        { href: "/guides/letter-before-action", title: "Letter Before Action: the full guide", desc: "The rules for the pre-court letter, including the 30-day route for sole traders." },
      ]}
    >
      <ul className={s.jump}>
        <li><a href="#overdue-30-days">30 days overdue</a></li>
        <li><a href="#overdue-60-days">60 days overdue</a></li>
        <li><a href="#overdue-90-days">90 days overdue</a></li>
      </ul>

      <h2>What an overdue invoice is worth at 30, 60 and 90 days</h2>
      <p>
        An unpaid business invoice grows. Under the Late Payment of Commercial Debts (Interest) Act 1998 it earns statutory interest every day it is late, currently {rate}% a year, and a one-off fixed sum for your recovery costs. Here is a £2,000 invoice at each stage.
      </p>
      <table className={s.timeline}>
        <thead>
          <tr><th>Overdue</th><th>Interest</th><th>Fixed sum</th><th>Total due</th></tr>
        </thead>
        <tbody>
          {[30, 60, 90].map((d) => (
            <tr key={d}>
              <td>{d} days</td>
              <td>{gbp(interestAt(d))}</td>
              <td>{gbp(FIXED)}</td>
              <td>{gbp(EG + FIXED + interestAt(d))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Use the <a href="/calculator">late payment calculator</a> for your own figures. These charges apply to invoices between businesses. For an invoice to a consumer, remove the interest and fixed sum from the letters below unless your contract provides for them.
      </p>

      <h2>30 days overdue: apply the statutory charges</h2>
      <p>
        At 30 days you have sent your reminders and the invoice is still unpaid. This letter stops asking and starts counting. It adds the interest and the fixed sum, gives the new total, and asks for any dispute in writing, which closes off "we had a query" as a later excuse.
      </p>
      <LetterBlock
        id="overdue-30-days"
        title="Overdue invoice letter: 30 days"
        text={letter30(rate)}
        note="If you have not sent any reminders yet, start with the payment reminder templates instead."
      />

      <h2>60 days overdue: last notice before legal action</h2>
      <p>
        Two months late, with a formal notice already ignored, the question is no longer whether the client knows. This letter is short on purpose. It restates the total, gives seven days and says that the next step is the court process. It also leaves the door open for a payment proposal, which is often what a client in difficulty needs to be asked for.
      </p>
      <LetterBlock
        id="overdue-60-days"
        title="Overdue invoice letter: 60 days"
        text={letter60}
        note="Post this as well as emailing it, and keep the proof of postage."
      />

      <h2>90 days overdue: letter before claim</h2>
      <p>
        At 90 days, send the letter that the courts expect to see before a claim is issued. It sets out the debt, the amount claimed and how it is calculated, a 14-day deadline, and what you will do when it passes. This version is written for a debtor that is a <strong>limited company</strong>. Post it to the registered office shown on Companies House.
      </p>
      <LetterBlock
        id="overdue-90-days"
        title="Overdue invoice letter: 90 days (letter before claim)"
        text={letter90}
        note="For a sole trader or individual, the rules differ: 30 days to respond, with the official information sheet and reply form enclosed."
      />
      <div className={s.callout}>
        <p>
          <strong>Debtor is a sole trader or an individual?</strong> The Pre-Action Protocol for Debt Claims applies instead. See our <a href="/guides/letter-before-action">Letter Before Action guide</a> for what to change.
        </p>
      </div>

      <h2>You do not have to wait 90 days</h2>
      <p>
        The 30, 60 and 90 day pattern comes from how accounts departments age their debts, not from the law. Nothing in UK law makes you wait three months before a letter before claim. If your reminders and a final demand have been ignored at 30 days, you can send it then.
      </p>
      <p>
        There is a good reason to move faster. The chance of collecting a debt falls the longer it is left. A client who is slow at 30 days may be insolvent at 120. If you are reading this with an invoice that is already 90 days late, skip the earlier letters and send the letter before claim now.
      </p>

      <h2>Sending these letters</h2>
      <ul>
        <li><strong>Email and post.</strong> Email gives you a timestamp. First class post, with free proof of postage from the Post Office counter, answers "we never received it".</li>
        <li><strong>Use the right name and address.</strong> For a limited company, check the exact company name and registered office on Companies House. A claim against the wrong entity fails.</li>
        <li><strong>Give deadlines as dates.</strong> "By 14 March" cannot be argued with. "Within 14 days" can.</li>
        <li><strong>Keep everything.</strong> The invoice, each letter, proof of postage and any replies are the file you would give the court.</li>
      </ul>

      <h2>If the last letter is ignored</h2>
      <p>
        Once the deadline in the letter before claim has passed, you can issue a claim. For debts under £10,000 this is done online, without a solicitor, and the court fee is added to what the debtor owes. Our guide to the <a href="/guides/small-claims-court-unpaid-invoice">small claims court for unpaid invoices</a> explains the fees and the steps.
      </p>
      <p>
        Hielda runs this sequence so that invoices rarely reach 90 days: reminders from before the due date, the statutory charges added from the first day overdue and recalculated daily, and a Letter Before Action drafted from the invoice when you choose to send it.
      </p>
    </GuideLayout>
  )
}
