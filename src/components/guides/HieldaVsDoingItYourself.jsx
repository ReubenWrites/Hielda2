import { getRate } from "../../constants"
import GuideLayout from "./GuideLayout"
import CompareTable from "./CompareTable"
import { comparisonSchema, HIELDA_PRICE, HIELDA_TRIAL } from "./comparisonSchema"
import s from "./guides.module.css"

const TITLE = "Hielda vs chasing invoices yourself: what £3.99 a month actually buys"
const LEDE = "Chasing your own invoices is free, and in the first fortnight it works. The problems are consistency, the awkwardness of asking for interest, and the hours it eats. This page sets out exactly what doing it yourself involves, what Hielda takes off your hands, and where DIY is still the right call."
const CANONICAL = "/guides/hielda-vs-doing-it-yourself"

const FAQS = [
  { q: "Can I chase late invoices myself for free?", a: "Yes. You can send reminders, cite the Late Payment Act, calculate the statutory interest with a free calculator, write a Letter Before Action and file a claim at Money Claim Online without any software. The cost is time and the discipline to keep chasing on a schedule while the silence gets more awkward." },
  { q: "How long does chasing one late invoice take by hand?", a: "A proper sequence is eight to ten emails over the first 30 days, each with an updated interest figure, plus a formal letter. Budget 20 to 30 minutes for the first chase and 10 to 15 for each subsequent one, so roughly two to three hours per invoice over a month, more if the client replies and the thread needs managing." },
  { q: "Do I lose anything by letting Hielda chase instead of doing it myself?", a: "Control is the usual worry, and Hielda is built around it: it checks whether you've been paid before every step, you confirm every email, and you can pause, dispute, disable charges or stop at any point. What you give up is writing each email yourself." },
  { q: "Is asking for statutory interest going to annoy my client?", a: "Clients who pay on time never see it; the charges only appear once an invoice is overdue. The early reminders are polite and the interest is stated as a fact of the Act rather than a threat. In practice a clearly stated, growing total gets invoices paid faster, which is better for the relationship than months of nagging." },
  { q: "When is doing it yourself the better choice?", a: "If you send one or two invoices a year, have a single long-standing client who always pays within a week of a nudge, or want to handle a specific sensitive invoice personally. For a disputed invoice, a personal conversation beats any automated sequence." },
]

export default function HieldaVsDoingItYourself({ onBack, onGetStarted }) {
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
        { href: "/guides/how-to-chase-late-invoices", title: "How to chase late invoices", desc: "The full day-by-day sequence if you want to run it yourself." },
        { href: "/guides/how-much-interest-late-invoice", title: "How much interest can you charge?", desc: "The formula and worked examples." },
        { href: "/guides/hielda-vs-xero-invoice-reminders", title: "Hielda vs accounting software reminders", desc: "If you already have Xero, QuickBooks or FreeAgent." },
      ]}
    >
      <h2>What doing it yourself actually involves</h2>
      <p>
        Properly done, chasing is not one email. It is a <a href="/guides/how-to-chase-late-invoices">sequence</a>: a friendly reminder before the due date, a firmer one on the day, then chases at days 1, 7, 14, 21 and 30, each stating the amount now owed with statutory interest at {getRate()}% a year and the £40, £70 or £100 fixed recovery cost added, then a Letter Before Action, then monthly formal reminders until it is paid. Each one needs the interest recalculating, a tone a notch firmer than the last, and sending on the day it is due, not when you next remember.
      </p>
      <p>
        Most people do the first two steps, then go quiet for three weeks, then send something angry. Inconsistent chasing teaches a client that ignoring you works. The sequence works because it never stops and never escalates faster than it promised.
      </p>

      <h2>Hielda vs doing it yourself at a glance</h2>
      <CompareTable
        colA="Hielda"
        colB="Doing it yourself"
        rows={[
          { label: "Cost", a: HIELDA_PRICE, b: "Free" },
          { label: "Time per late invoice over a month", a: "A few minutes: confirm each step", b: "Two to three hours" },
          { label: "Chases sent on schedule, every time", a: true, b: "Depends on you" },
          { label: "Statutory interest recalculated for every email", a: true, b: "By hand, with a calculator" },
          { label: "Fixed recovery cost added", a: true, b: "If you remember and feel able to ask" },
          { label: "Tone escalates in measured steps", a: true, b: "Usually polite, polite, silence, angry" },
          { label: "Letter Before Action", a: "Drafted from the invoice at day 30", b: "Write it yourself from a template" },
          { label: "Reminders to you before each step", a: true, b: "Calendar entries, if you make them" },
          { label: "You confirm every email", a: true, b: true },
          { label: "Handles part payments, disputes, pauses", a: true, b: "Manually" },
          { label: "Personal touch and phone calls", a: false, b: true },
          { label: "Free trial", a: HIELDA_TRIAL, b: "n/a" },
        ]}
      />

      <h2>The awkwardness problem</h2>
      <p>
        The hardest part of DIY is not the arithmetic. It is that asking for interest on top of an unpaid invoice feels like picking a fight, so almost nobody does it, and the Act's whole purpose, making late payment cost the payer rather than the supplier, goes unused. A chase from Hielda states the charges as what the law provides, in a measured tone, with the breakdown attached. You are not the bad guy; the Act is. That alone is why many users switch: not because they could not do it, but because they were not doing it.
      </p>

      <h2>When DIY is the right answer</h2>
      <ul>
        <li><strong>One client, long relationship, rare lateness.</strong> A friendly email from you is enough and the subscription is not worth it.</li>
        <li><strong>A disputed invoice.</strong> No sequence beats a phone call to find out what the actual problem is. Hielda pauses chasing on disputed invoices for exactly this reason.</li>
        <li><strong>You genuinely enjoy credit control.</strong> Some people do. The <a href="/guides/how-to-chase-late-invoices">playbook</a> and the free <a href="/calculator">calculator</a> and <a href="/late-payment-letter-template">letter generator</a> are there for you regardless.</li>
      </ul>

      <h2>How to decide</h2>
      <div className={s.callout}>
        <p><strong>Do it yourself</strong> if lateness is rare and you will actually follow the schedule. Use the free tools on this site for the interest and the letter.</p>
        <p><strong>Use Hielda</strong> if you have ever let an invoice drift past 30 days because chasing felt like a chore, or ever written off interest you were entitled to. The 6-week trial covers one full chase sequence end to end, so you can judge it on a real invoice.</p>
      </div>
    </GuideLayout>
  )
}
