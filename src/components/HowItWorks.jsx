import { colors as c, BOE, RATE, MONO } from "../constants"
import { Card } from "./ui"

const TIMELINE_STEPS = [
  { day: "Day -5", title: "Friendly Reminder", desc: "We check in with you first. If unpaid, we send a polite heads-up to your client.", col: c.ac, ico: "📋" },
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
      <h1 style={{ fontSize: 21, fontWeight: 700, color: c.tx, margin: "0 0 5px" }}>How It Works</h1>
      <p style={{ color: c.tm, margin: "0 0 22px", fontSize: 13 }}>Your rights, and how Hielda enforces them.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: c.ac, margin: "0 0 10px" }}>Your Legal Rights</h3>
          <div style={{ fontSize: 13, color: c.tm, lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 8px" }}>
              If a company doesn't pay you on time, you have the right to charge interest and additional fines under the{" "}
              <strong style={{ color: c.tx }}>Late Payment of Commercial Debts (Interest) Act 1998</strong>.
            </p>
            <div style={{ padding: 10, background: c.bg, borderRadius: 8, margin: "10px 0", fontSize: 12 }}>
              <div style={{ marginBottom: 5 }}><strong style={{ color: c.tx }}>Penalty:</strong> £40 / £70 / £100</div>
              <div style={{ marginBottom: 5 }}>
                <strong style={{ color: c.tx }}>Interest:</strong> 8% + BoE ({BOE}%) ={" "}
                <span style={{ color: c.go, fontFamily: MONO }}>{RATE}%</span> p.a.
              </div>
              <div><strong style={{ color: c.tx }}>Daily</strong> from the day after due</div>
            </div>
            <p style={{ margin: "8px 0 0" }}>
              Most freelancers don't enforce this because they worry companies will hold it against them. But if a client withholds your pay, for their benefit, we think it's only fair that you are compensated for the inconvenience.
            </p>
            <p style={{ margin: "8px 0 0" }}>
              Hielda chases on your behalf to ensure you're paid the maximum you're fairly and legally entitled to.
            </p>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: c.ac, margin: "0 0 10px" }}>Why It Works</h3>
          <div style={{ fontSize: 13, color: c.tm, lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 8px" }}>Companies pay late because there are no consequences.</p>
            <p style={{ margin: "0 0 8px" }}>A third-party notice citing legislation changes everything:</p>
            <div style={{ padding: 10, background: c.bg, borderRadius: 8, fontSize: 12, lineHeight: 1.7 }}>
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
        <h3 style={{ fontSize: 13, fontWeight: 700, color: c.ac, margin: "0 0 16px" }}>Chase Timeline</h3>
        <p style={{ fontSize: 12, color: c.tm, marginBottom: 16, lineHeight: 1.5 }}>
          Every step is preceded by a check-in with you. We always ask "have you been paid?" before sending anything to your client.
        </p>
        {TIMELINE_STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 16, marginBottom: 16, paddingBottom: 16, borderBottom: i < TIMELINE_STEPS.length - 1 ? `1px solid ${c.bdl}` : "none" }}>
            <div style={{ width: 68, flexShrink: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: s.col }}>{s.day}</div>
            </div>
            <div style={{ fontSize: 20, width: 34, flexShrink: 0, textAlign: "center" }} aria-hidden="true">{s.ico}</div>
            <div>
              <div style={{ fontWeight: 600, color: c.tx, fontSize: 13, marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: c.tm, lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 22 }}>
        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: c.ac, margin: "0 0 12px" }}>Frequently Asked</h3>
          {[
            { q: "Will this damage my client relationships?", a: "Most late-paying clients expect to be chased. The early reminders are polite and professional — it's only unpaid invoices that escalate. You can also disable fines for specific invoices if you prefer a softer approach." },
            { q: "Does this apply to all businesses?", a: "The Act applies to business-to-business transactions in England, Wales and Scotland. It doesn't cover consumer debts or contracts with public authorities (which have separate rules)." },
            { q: "What if my client disputes the invoice?", a: "Hielda always checks in with you before sending each chase. If there's a dispute, simply tell us not to send the next email and resolve it directly with your client." },
            { q: "Do I have to charge interest?", a: "No — it's your right, not an obligation. When creating an invoice, tick 'Chase without fines' to send reminders without adding penalties. You can always change this later." },
          ].map((faq, i) => (
            <div key={i} style={{ marginBottom: i < 3 ? 14 : 0, paddingBottom: i < 3 ? 14 : 0, borderBottom: i < 3 ? `1px solid ${c.bdl}` : "none" }}>
              <div style={{ fontWeight: 600, color: c.tx, fontSize: 12, marginBottom: 4 }}>{faq.q}</div>
              <div style={{ fontSize: 11.5, color: c.tm, lineHeight: 1.5 }}>{faq.a}</div>
            </div>
          ))}
        </Card>

        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: c.ac, margin: "0 0 12px" }}>Penalty Breakdown</h3>
          <p style={{ fontSize: 12, color: c.tm, margin: "0 0 12px", lineHeight: 1.5 }}>
            The fixed penalty depends on the invoice value:
          </p>
          <div style={{ background: c.bg, borderRadius: 8, overflow: "hidden" }}>
            {[
              { range: "Up to £999.99", penalty: "£40" },
              { range: "£1,000 – £9,999.99", penalty: "£70" },
              { range: "£10,000+", penalty: "£100" },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < 2 ? `1px solid ${c.bdl}` : "none" }}>
                <span style={{ fontSize: 12, color: c.tm }}>{row.range}</span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: c.ac }}>{row.penalty}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: c.td, margin: "12px 0 0", lineHeight: 1.5 }}>
            Interest accrues daily at {RATE}% per annum from the day after the due date. For a £5,000 invoice, that's roughly £1.61 per day.
          </p>

          <h3 style={{ fontSize: 13, fontWeight: 700, color: c.ac, margin: "20px 0 10px" }}>Example</h3>
          <div style={{ background: c.bg, borderRadius: 8, padding: 14, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: c.tm }}>Invoice</span>
              <span style={{ fontFamily: MONO, color: c.tx }}>£3,000.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: c.tm }}>30 days late — penalty</span>
              <span style={{ fontFamily: MONO, color: c.or }}>+ £40.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: c.tm }}>30 days interest ({RATE}% p.a.)</span>
              <span style={{ fontFamily: MONO, color: c.or }}>+ £28.97</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `2px solid ${c.ac}` }}>
              <span style={{ fontWeight: 700, color: c.tx }}>Total owed</span>
              <span style={{ fontWeight: 700, fontFamily: MONO, color: c.ac }}>£3,068.97</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
