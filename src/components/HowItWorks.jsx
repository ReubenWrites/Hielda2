import { getRate, getBoe } from "../constants"
import { Card } from "./ui"
import s from './HowItWorks.module.css'

const TIMELINE_STEPS = [
  { day: "Day -5", title: "Friendly Reminder", desc: "We check in with you first. If unpaid, we send a polite heads-up to your client.", col: "var(--ac)", ico: "📋" },
  { day: "Day -1", title: "Second Reminder", desc: "Another check-in with you. If still unpaid, a firmer reminder goes out.", col: "#2d72b8", ico: "📬" },
  { day: "Day 0", title: "Final Warning", desc: "Due date. Last chance to settle at the original amount — warns that fines and interest start tomorrow.", col: "#b45309", ico: "⚠️" },
  { day: "Day +1", title: "First Chase", desc: "Fines and interest now applied. Formal notice citing the Act with the new total owed.", col: "#d97706", ico: "⚡" },
  { day: "Day +6–25", title: "Regular Chasing", desc: "Chase emails every 2 days, each with updated interest. The amount grows daily — pressure builds.", col: "#c2410c", ico: "📊" },
  { day: "Day +26–29", title: "Daily Escalation Warnings", desc: "Daily countdown emails warning that formal recovery (debt agency / County Court) begins in X days.", col: "#7f1d1d", ico: "🔴" },
  { day: "Day +30", title: "Final Notice", desc: "Last formal demand. If still unpaid, we'll support you to escalate to County Court if you choose to.", col: "#7f1d1d", ico: "⚖️" },
]

export default function HowItWorks() {
  return (
    <div>
      <h1 className={s.title}>How It Works</h1>
      <p className={s.subtitle}>Your rights, and how Hielda enforces them.</p>

      <div className={s.topGrid}>
        <Card>
          <h3 className={s.sectionTitle}>Your Legal Rights</h3>
          <div className={s.bodyText}>
            <p className={s.bodyParagraph}>
              If a company doesn't pay you on time, you have the right to charge interest and additional fines under the{" "}
              <strong className={s.legalStrong}>Late Payment of Commercial Debts (Interest) Act 1998</strong>.
            </p>
            <div className={s.infoBox}>
              <div className={s.infoRow}><strong className={s.legalStrong}>Penalty:</strong> £40 / £70 / £100</div>
              <div className={s.infoRow}>
                <strong className={s.legalStrong}>Interest:</strong> 8% + BoE ({getBoe()}%) ={" "}
                <span className={s.rateValue}>{getRate()}%</span> p.a.
              </div>
              <div className={s.infoRowLast}><strong className={s.legalStrong}>Daily</strong> from the day after due</div>
            </div>
            <p className={s.bodyParagraphLast}>
              Most freelancers don't enforce this because they worry companies will hold it against them. But if a client withholds your pay, for their benefit, we think it's only fair that you are compensated for the inconvenience.
            </p>
            <p className={s.bodyParagraphLast}>
              Hielda chases on your behalf to ensure you're paid the maximum you're fairly and legally entitled to.
            </p>
          </div>
        </Card>

        <Card>
          <h3 className={s.sectionTitle}>Why It Works</h3>
          <div className={s.bodyText}>
            <p className={s.bodyParagraph}>Companies pay late because there are no consequences.</p>
            <p className={s.bodyParagraph}>A third-party notice citing legislation changes everything:</p>
            <div className={s.checkList}>
              <div>✓ Client knows you're serious</div>
              <div>✓ You're not the bad guy — we are</div>
              <div>✓ Real financial penalties</div>
              <div>✓ CCJ threat hits credit rating</div>
              <div>✓ Completely legal</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className={s.timelineTitle}>Chase Timeline</h3>
        <p className={s.timelineIntro}>
          Every step is preceded by a check-in with you. We always ask "have you been paid?" before sending anything to your client.
        </p>
        {TIMELINE_STEPS.map((step, i) => (
          <div key={i} className={`${s.timelineStep} ${i < TIMELINE_STEPS.length - 1 ? s.timelineStepBorder : ""}`}>
            <div className={s.stepLeft}>
              <div className={s.stepIcon} aria-hidden="true">{step.ico}</div>
              <div className={s.stepDay} style={{ color: step.col }}>{step.day}</div>
            </div>
            <div className={s.stepContent}>
              <div className={s.stepTitle}>{step.title}</div>
              <div className={s.stepDesc}>{step.desc}</div>
            </div>
          </div>
        ))}
      </Card>

      <div className={s.bottomGrid}>
        <Card>
          <h3 className={s.faqTitle}>Frequently Asked</h3>
          {[
            { q: "Will this damage my client relationships?", a: "Most late-paying clients expect to be chased. The early reminders are polite and professional — it's only unpaid invoices that escalate. You can also disable fines for specific invoices if you prefer a softer approach." },
            { q: "Does this apply to all businesses?", a: "The Act applies to business-to-business transactions in England, Wales and Scotland. It doesn't cover consumer debts or contracts with public authorities (which have separate rules)." },
            { q: "What if my client disputes the invoice?", a: "Hielda always checks in with you before sending each chase. If there's a dispute, simply tell us not to send the next email and resolve it directly with your client." },
            { q: "Do I have to charge interest?", a: "No — it's your right, not an obligation. When creating an invoice, tick 'Chase without fines' to send reminders without adding penalties. You can always change this later." },
          ].map((faq, i) => (
            <div key={i} className={i < 3 ? s.faqItem : s.faqItemLast}>
              <div className={s.faqQuestion}>{faq.q}</div>
              <div className={s.faqAnswer}>{faq.a}</div>
            </div>
          ))}
        </Card>

        <Card>
          <h3 className={s.penaltyTitle}>Penalty Breakdown</h3>
          <p className={s.penaltyIntro}>
            The fixed penalty depends on the invoice value:
          </p>
          <div className={s.penaltyTable}>
            {[
              { range: "Up to £999.99", penalty: "£40" },
              { range: "£1,000 – £9,999.99", penalty: "£70" },
              { range: "£10,000+", penalty: "£100" },
            ].map((row, i) => (
              <div key={i} className={`${s.penaltyRow} ${i < 2 ? s.penaltyRowBorder : ""}`}>
                <span className={s.penaltyRange}>{row.range}</span>
                <span className={s.penaltyAmount}>{row.penalty}</span>
              </div>
            ))}
          </div>
          <p className={s.penaltyNote}>
            Interest accrues daily at {getRate()}% per annum from the day after the due date. For a £5,000 invoice, that's roughly £1.61 per day.
          </p>

          <h3 className={s.exampleTitle}>Example</h3>
          <div className={s.exampleBox}>
            <div className={s.exampleRow}>
              <span className={s.exampleLabel}>Invoice</span>
              <span className={s.exampleValue}>£3,000.00</span>
            </div>
            <div className={s.exampleRow}>
              <span className={s.exampleLabel}>30 days late — penalty</span>
              <span className={s.exampleValueOr}>+ £40.00</span>
            </div>
            <div className={s.exampleRow}>
              <span className={s.exampleLabel}>30 days interest ({getRate()}% p.a.)</span>
              <span className={s.exampleValueOr}>+ £28.97</span>
            </div>
            <div className={s.exampleTotal}>
              <span className={s.exampleTotalLabel}>Total owed</span>
              <span className={s.exampleTotalValue}>£3,068.97</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
