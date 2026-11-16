import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import LetterBlock from "./LetterBlock"
import { comparisonSchema } from "./comparisonSchema"
import s from "./guides.module.css"

// /guides/production-company-not-paying-invoice
// Written for crew who invoice. Claims are kept to what the law says and
// what a freelancer can check for themselves (Companies House, the deal
// memo). Nothing here says a parent company or broadcaster is liable for a
// production company's debt, because in general it is not.

const TITLE = "Production company not paying your invoice? What film and TV freelancers can do"
const LEDE = "The job has wrapped, the invoice is weeks late and the production office has gone quiet. Here is what to do, in order: who to chase, what to check on Companies House, what the law lets you add, and what changes if the company behind the production is about to disappear."
const CANONICAL = "/guides/production-company-not-paying-invoice"

const CHASE_EMAIL = `Subject: [Production title]: invoice [number], [£amount], due [due date]

Hi [Name],

I worked on [production title] as [role] from [date] to [date]. My invoice [number] for [£amount] was sent to [email address] on [date] and was due on [due date]. It has not been paid.

Could you confirm by reply:

1. that the invoice has been approved and is on the system, and
2. the date of the payment run it will go in?

If anything is missing, such as a PO number, a supplier form or bank verification, tell me what you need and I will send it today. The invoice is attached again.

Thanks,
[Your name]
[Phone number]`

const FAQS = [
  { q: "How long should a production company take to pay an invoice?", a: "Whatever was agreed in your deal memo or contract. If nothing was agreed, the legal default between businesses is 30 days from the invoice or from the work being done, whichever is later. Terms longer than 60 days are only valid if they are not grossly unfair to you." },
  { q: "The production has wrapped and the office has closed. Who do I chase?", a: "The company named on your deal memo still owes the money. Write to the production accountant and the line producer or producer who booked you, and send formal letters to the company's registered office, which you can find on Companies House. If the production company belongs to a larger group, copy in that group's finance or production department as well." },
  { q: "Can I charge a production company interest on a late invoice?", a: "Yes, if you invoiced as a sole trader or through your own limited company. The Late Payment of Commercial Debts (Interest) Act 1998 gives you statutory interest at 8% above the Bank of England base rate, plus a fixed sum of £40, £70 or £100 per invoice. You do not need a clause in your deal memo. It does not apply if you were paid through the production's payroll." },
  { q: "The production was made through a company set up just for that job. Can I claim from the parent company?", a: "Generally, no. Your contract is with the company named on your deal memo, and a parent company is not automatically liable for its debts. In practice a parent with a reputation to protect will often make sure crew are paid, so tell them. But the legal claim is against the company you contracted with." },
  { q: "What if the production company goes into administration or liquidation?", a: "You become an unsecured creditor. You can no longer chase or sue in the normal way. Instead you send a proof of debt to the insolvency practitioner handling the company, whose details appear on Companies House and in The Gazette. Include the statutory interest and fixed sum up to the date of insolvency. Unsecured creditors often recover only part of what they are owed, which is why it pays to act before a company reaches that point." },
  { q: "Will chasing get me blacklisted?", a: "A polite reminder to an accounts department is routine and nobody remembers it. A formal letter citing the law is firmer, but it is aimed at the company, not at the people who hire you, and by that stage they have already let you down. Keep every message factual and unemotional, and send it to accounts and production management rather than complaining on set or in public." },
  { q: "I was on the payroll, not invoicing. What can I do?", a: "Late or unpaid wages are an employment matter, and the Late Payment Act does not apply. Contact your union if you have one, or Acas. There are short time limits for employment tribunal claims over unpaid wages, so do not leave it." },
]

export default function ProductionCompanyNotPayingInvoice({ onBack, onGetStarted }) {
  const rate = getRate()
  const schema = comparisonSchema({ title: TITLE, lede: LEDE, canonical: CANONICAL, faqs: FAQS })
  const gbp = (n) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  // Two weeks at £400 a day plus kit, paid 60 days late.
  const eg = { fee: 4000, kit: 600, days: 60, fixed: 70 }
  const egTotal = eg.fee + eg.kit
  const egInterest = Math.round(egTotal * (rate / 100) * (eg.days / 365) * 100) / 100

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
        { href: "/film-tv-freelancers", title: "Hielda for film and TV freelancers", desc: "Chasing built around how crew are paid: day rates, kit hire, PO numbers and productions that wrap and go quiet." },
        { href: "/guides/film-tv-invoice-payment-terms", title: "Invoicing a production: terms, POs and deal memos", desc: "What to agree before day one and what to put on the invoice so it gets paid first time." },
        { href: "/guides/final-demand-letter-template", title: "Final demand letter template", desc: "The letter to send when the production's accounts team has stopped replying." },
      ]}
    >
      <h2>First, check you are covered</h2>
      <p>
        Everything below applies if you <strong>invoice</strong> the production, as a sole trader or through your own limited company. That is a contract between two businesses, and the law on late commercial payment is on your side. It covers your fee, kit hire and expenses you were entitled to re-charge.
      </p>
      <p>
        If you were paid through the production's payroll, this is a wages issue instead. Speak to your union or to Acas. The rest of this guide is for people who send invoices.
      </p>

      <h2>Why productions pay late</h2>
      <p>
        It is rarely a decision. The production accountant has moved to the next job. Your invoice went to a coordinator's inbox that nobody reads after wrap. The purchase order was never raised, so accounts cannot match the invoice to anything. Or the final tranche of funding has not arrived, and suppliers are being paid in the order they shout.
      </p>
      <p>
        All of these are fixed the same way: by a written request to the right person, with a date on it, sent early. The freelancers who wait politely are the ones still waiting when the company is wound down.
      </p>

      <h2>What to do, step by step</h2>

      <h3>1. Check the paperwork (today)</h3>
      <ul>
        <li><strong>The company name.</strong> Look at your deal memo or contract. Productions are commonly made through a company set up for that one job, and its name is often not the name on the call sheet. Your invoice must be addressed to the company that engaged you.</li>
        <li><strong>The PO or job number.</strong> If accounts need one and it is missing, the invoice will sit unpaid without anyone telling you.</li>
        <li><strong>Where it was sent.</strong> Many productions only pay invoices sent to a dedicated accounts address.</li>
      </ul>

      <h3>2. Ask accounts for a payment date (day 1 overdue)</h3>
      <p>
        Write to the production accountant or accounts address, and copy in whoever booked you. Ask two closed questions that cannot be answered with "it's in hand".
      </p>
      <LetterBlock
        id="chase-email"
        title="Chase email to a production accountant"
        text={CHASE_EMAIL}
        note="Send it the day after the due date. Early chasing is normal in every other industry."
      />

      <h3>3. Add what the law allows (from the first day overdue)</h3>
      <p>
        Under the <a href="/guides/late-payment-act-1998-explained">Late Payment Act</a> your invoice earns statutory interest at 8% above the Bank of England base rate, currently {rate}% a year, plus a fixed sum of £40, £70 or £100. No clause in your deal memo is needed. Say so in your second message and give a 7-day deadline. Our <a href="/guides/payment-reminder-letter-template">payment reminder templates</a> have the wording.
      </p>
      <div className={s.workedExample}>
        <h3>Example: two weeks on a drama, paid 60 days late</h3>
        <table>
          <tbody>
            <tr><td>10 days at £400</td><td>{gbp(eg.fee)}</td></tr>
            <tr><td>Kit hire, two weeks</td><td>{gbp(eg.kit)}</td></tr>
            <tr><td>Statutory interest ({eg.days} days at {rate}%)</td><td>+ {gbp(egInterest)}</td></tr>
            <tr><td>Fixed recovery sum</td><td>+ {gbp(eg.fixed)}</td></tr>
            <tr><td><strong>Now owed</strong></td><td>{gbp(egTotal + egInterest + eg.fixed)}</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Work out your own figure with the <a href="/calculator">late payment calculator</a>.
        </p>
      </div>

      <h3>4. Go up a level (two weeks overdue)</h3>
      <p>
        If accounts do not reply, write to the line producer or producer. If the production company is part of a larger group, write to that group's finance or production department too. They may not owe you the money in law, but they have the authority to get an invoice paid and a reason to care that crew are talking about it.
      </p>
      <p>
        If you are a member of Bectu or Equity, tell your union now. Recovering unpaid fees is part of what they do, and a call from them often works.
      </p>

      <h3>5. Send a final demand (three to four weeks overdue)</h3>
      <p>
        Address it to the company on your deal memo and post it to the registered office shown on Companies House, as well as emailing it. Use our <a href="/guides/final-demand-letter-template">final demand template</a>. If that is ignored, follow it with a <a href="/guides/letter-before-action">Letter Before Action</a>.
      </p>

      <h3>6. Issue a claim (after the letter's deadline)</h3>
      <p>
        For debts under £10,000 you can issue a court claim online without a solicitor, and the fee is added to what the company owes. See <a href="/guides/small-claims-court-unpaid-invoice">small claims court for an unpaid invoice</a>. A company that is still trading usually pays when the claim arrives.
      </p>

      <h2>Check the company on Companies House</h2>
      <p>
        This takes two minutes, costs nothing and tells you how fast to move. Search the exact company name from your deal memo and look for three things.
      </p>
      <ul>
        <li><strong>Company status.</strong> "Active" is what you want. "Active, proposal to strike off" means the company is on its way to being dissolved.</li>
        <li><strong>The registered office.</strong> This is where formal letters and court papers go.</li>
        <li><strong>Recent filings.</strong> An application to strike the company off, or the appointment of an administrator or liquidator, changes what you should do next.</li>
      </ul>
      <div className={s.callout}>
        <p>
          <strong>If the company has applied to be struck off while it owes you money</strong>, you can object. Write to Companies House with a copy of your unpaid invoice. An objection from a creditor normally stops the company being dissolved while the debt is dealt with. Do it quickly, because the notice period is short.
        </p>
      </div>

      <h2>If the company becomes insolvent</h2>
      <p>
        Once a company is in administration or liquidation, chasing stops. You are an unsecured creditor, and your claim goes to the insolvency practitioner as a proof of debt. Include the invoice, the fixed sum and interest up to the date the insolvency began. Unsecured creditors often get back only part of what they are owed, and sometimes nothing.
      </p>
      <p>
        That is the real argument for chasing early. A late invoice is easiest to collect while the production office is staffed and the company has money in the bank.
      </p>

      <h2>Keeping it professional</h2>
      <p>
        You will probably work with some of these people again, so keep every message short and factual, and keep it in writing. Write to accounts and production management, not to the director. Do not post about it in crew groups: a public post naming a company can cause you trouble if any detail turns out to be wrong, and it rarely gets an invoice paid.
      </p>
      <p>
        Many crew would rather not send these emails at all. That is what Hielda is for. It sends the reminders and formal notices on your behalf, adds the interest and fixed sum to the day, and asks for your approval before each one goes. See <a href="/film-tv-freelancers">Hielda for film and TV freelancers</a>.
      </p>
    </GuideLayout>
  )
}
