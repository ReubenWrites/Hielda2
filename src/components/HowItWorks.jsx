import { colors as c, BOE, RATE, MONO } from "../constants"
import { Card } from "./ui"

const TIMELINE_STEPS = [
  { day: "Day -5", title: "Friendly Reminder", desc: "We check in with you first. If unpaid, we send a polite heads-up to your client.", col: c.ac, ico: "📋" },
  { day: "Day -1", title: "Second Reminder", desc: "Another check-in with you. If still unpaid, a firmer nudge goes out.", col: "#2d72b8", ico: "📬" },
  { day: "Day +1", title: "First Chase", desc: "Check-in with you. If unpaid, formal notice citing the Act. 7-day deadline.", col: "#d97706", ico: "⚡" },
  { day: "Day +14", title: "Second Chase + Interest", desc: "Check-in with you. Escalated notice with accrued interest and penalties. You're BCC'd.", col: "#c2410c", ico: "📊" },
  { day: "Day +30", title: "Final Notice", desc: "Last formal demand. If still unpaid, we'll support you to escalate to County Court if you choose to.", col: "#9f1239", ico: "⚖️" },
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
    </div>
  )
}
