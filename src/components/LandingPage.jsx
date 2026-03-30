import { colors as c, FONT, MONO, getRate, getBoe } from "../constants"
import { ShieldLogo } from "./ui"

const FEATURES = [
  {
    ico: "🛡️",
    title: "Automatic Chase Emails",
    desc: "From friendly reminders to formal legal notices — Hielda sends escalating chase emails on your behalf so you don't have to.",
  },
  {
    ico: "⚖️",
    title: "Statutory Interest & Fines",
    desc: "Under the Late Payment of Commercial Debts Act 1998, you're legally entitled to charge interest and penalties. Hielda calculates and enforces them for you.",
  },
  {
    ico: "📧",
    title: "Check-in Before Every Step",
    desc: "We always ask you first — 'Has your client paid?' — before sending the next chase. You stay in full control.",
  },
  {
    ico: "📊",
    title: "19-Stage Chase Timeline",
    desc: "From 5 days before the due date to 30 days overdue. The pressure builds gradually, giving your client every chance to pay.",
  },
  {
    ico: "💰",
    title: "You Keep Every Penny",
    desc: "Interest and penalties are yours by law. Hielda ensures you receive every pound you're entitled to.",
  },
  {
    ico: "🔒",
    title: "Secure & Professional",
    desc: "AES-256 encryption, TLS in transit, and row-level access controls. Your data is protected to bank-grade standards.",
  },
]

const TIMELINE_PREVIEW = [
  { day: "Day -5", label: "Friendly Reminder", col: "#1e5fa0" },
  { day: "Day -1", label: "Second Reminder", col: "#2d72b8" },
  { day: "Day 0", label: "Final Warning", col: "#b45309" },
  { day: "Day +1", label: "Fines Applied", col: "#d97706" },
  { day: "Day +6–25", label: "Regular Chasing", col: "#c2410c" },
  { day: "Day +26–29", label: "Daily Escalation", col: "#7f1d1d" },
  { day: "Day +30", label: "Final Notice", col: "#7f1d1d" },
]

export default function LandingPage({ onGetStarted, onPrivacy, onCalculator, isMobile }) {
  return (
    <div style={{ fontFamily: FONT, color: c.tx, background: c.bg, minHeight: "100vh" }}>
      {/* Nav bar */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "14px 20px" : "14px 48px",
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${c.bd}`,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldLogo size={28} />
          <span style={{ fontSize: 20, fontWeight: 700, color: c.ac, letterSpacing: "-0.02em" }}>Hielda</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onCalculator}
            style={{
              background: "none", color: c.ac, border: "none",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: FONT, padding: "8px 4px",
            }}
          >
            Calculator
          </button>
          <button
            onClick={onGetStarted}
            style={{
              background: c.ac, color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Log In
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        padding: isMobile ? "48px 20px 40px" : "80px 48px 60px",
        textAlign: "center", maxWidth: 800, margin: "0 auto",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 14px", borderRadius: 999, fontSize: 11, fontWeight: 600,
          background: c.acd, color: c.ac, marginBottom: 20,
        }}>
          UK Late Payment Act 1998
        </div>
        <h1 style={{
          fontSize: isMobile ? 28 : 44, fontWeight: 700, color: c.tx,
          lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-0.02em",
        }}>
          They're using your invoice<br />
          <span style={{ color: c.ac }}>as a free loan. Time to charge for it.</span>
        </h1>
        <p style={{
          fontSize: isMobile ? 15 : 17, color: c.tm, lineHeight: 1.6,
          maxWidth: 620, margin: "0 auto 28px",
        }}>
          Large companies deliberately delay paying freelancers — using your money as their interest-free working capital. We know that as an individual or small business, it can be hard to assert your right to payment on time — or to levy the fees and fines you're entitled to — when you can't afford to damage the relationship. That's why we chase on your behalf, and if they're late paying, we add the charges for you, so you never have to be the bad guy.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={onGetStarted}
            style={{
              background: c.ac, color: "#fff", border: "none", borderRadius: 10,
              padding: "12px 32px", fontSize: 15, fontWeight: 600, cursor: "pointer",
              fontFamily: FONT, boxShadow: "0 2px 8px rgba(30,95,160,0.25)",
            }}
          >
            Start Free Trial
          </button>
          <button
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            style={{
              background: "transparent", color: c.ac, border: `1.5px solid ${c.ac}`,
              borderRadius: 10, padding: "12px 28px", fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: FONT,
            }}
          >
            See How It Works
          </button>
        </div>
        <p style={{ fontSize: 11, color: c.td, marginTop: 12 }}>
          No credit card required · 7-day free trial · Cancel anytime
        </p>
      </section>

      {/* The Problem */}
      <section style={{
        padding: isMobile ? "40px 20px" : "64px 48px",
        maxWidth: 960, margin: "0 auto",
      }}>
        <h2 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, textAlign: "center", margin: "0 0 8px" }}>
          The trap every freelancer knows
        </h2>
        <p style={{ textAlign: "center", color: c.tm, fontSize: 14, margin: "0 0 36px" }}>
          Late payment isn't an accident. It's a system — and it's designed to work against you.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
          gap: 20,
        }}>
          {[
            {
              ico: "🏦",
              title: "They do it on purpose",
              desc: "Large companies routinely delay paying freelancers by 30, 60, even 90 days. Your unpaid invoice is an interest-free loan — and their finance team knows exactly what they're doing.",
            },
            {
              ico: "😬",
              title: "You can't push back",
              desc: "You're legally entitled to charge statutory interest and fixed penalties. But asking your client directly risks souring the relationship, losing future work, and making every future email awkward. So most freelancers stay quiet — and never see that money.",
            },
            {
              ico: "⚖️",
              title: "The law is on your side",
              desc: "Under the Late Payment of Commercial Debts Act 1998, every overdue B2B invoice automatically accrues interest at 11.75% p.a. plus a fixed penalty of £40–£100. Most freelancers never claim it.",
            },
          ].map((f) => (
            <div key={f.title} style={{
              background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 14,
              padding: "24px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.ico}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: c.tx, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: c.tm, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The Solution — Trusted Third Party */}
      <section style={{
        padding: isMobile ? "40px 20px" : "64px 48px",
        background: c.sf, borderTop: `1px solid ${c.bd}`, borderBottom: `1px solid ${c.bd}`,
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: "0 0 16px" }}>
            You stay the good guy. We do the rest.
          </h2>
          <p style={{ color: c.tm, fontSize: isMobile ? 14 : 16, lineHeight: 1.7, margin: "0 0 40px", maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
            Think about how your client works. The person who hired you and their accounts department are completely separate teams. The accounts team chases invoices every day — it's nothing personal, it's just process. Now you have your own accounts department.
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr auto 1fr",
            gap: isMobile ? 16 : 24,
            alignItems: "center",
            textAlign: "left",
          }}>
            <div style={{ background: "#fff", border: `1px solid ${c.bd}`, borderRadius: 14, padding: "24px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.tm, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Their side</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.acd, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>👤</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: c.tx }}>The person who hired you</div>
                    <div style={{ fontSize: 11, color: c.tm }}>Loves your work. Not responsible for payment.</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🏢</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: c.tx }}>Their accounts department</div>
                    <div style={{ fontSize: 11, color: c.tm }}>Delays payment. Applies pressure. Nothing personal.</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", padding: isMobile ? "8px 0" : "0 8px", color: c.ac, fontWeight: 700, fontSize: isMobile ? 24 : 28 }}>
              =
            </div>

            <div style={{ background: "#fff", border: `2px solid ${c.ac}`, borderRadius: 14, padding: "24px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.ac, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Your side</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.acd, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🎨</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: c.tx }}>You</div>
                    <div style={{ fontSize: 11, color: c.tm }}>Do great work. Maintain the relationship.</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.acd, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🛡️</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: c.ac }}>Hielda</div>
                    <div style={{ fontSize: 11, color: c.tm }}>Chases payment. Applies fines. Nothing personal.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: c.tm, marginTop: 28, fontStyle: "italic" }}>
            "Our system has automatically applied statutory charges to your overdue invoice" is a very different conversation from "please pay me."
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{
        display: "flex", justifyContent: "center", gap: isMobile ? 20 : 48,
        padding: isMobile ? "24px 20px" : "28px 48px",
        background: c.sf, borderTop: `1px solid ${c.bd}`, borderBottom: `1px solid ${c.bd}`,
        flexWrap: "wrap",
      }}>
        {[
          { val: `${getRate()}%`, label: "Statutory interest rate" },
          { val: "£40–100", label: "Fixed penalty per invoice" },
          { val: "19", label: "Chase stages over 30 days" },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: c.ac, fontFamily: MONO }}>{s.val}</div>
            <div style={{ fontSize: 11, color: c.tm, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Features grid */}
      <section style={{
        padding: isMobile ? "40px 20px" : "64px 48px",
        maxWidth: 960, margin: "0 auto",
      }}>
        <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, textAlign: "center", margin: "0 0 8px" }}>
          Everything your accounts department would do
        </h2>
        <p style={{ textAlign: "center", color: c.tm, fontSize: 14, margin: "0 0 36px" }}>
          Hielda handles the uncomfortable conversations so you never have to.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
          gap: 20,
        }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 14,
              padding: "24px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{f.ico}</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: c.tx, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: c.tm, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Chase timeline preview */}
      <section id="how-it-works" style={{
        padding: isMobile ? "40px 20px" : "64px 48px",
        background: c.sf, borderTop: `1px solid ${c.bd}`, borderBottom: `1px solid ${c.bd}`,
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, textAlign: "center", margin: "0 0 8px" }}>
            How Hielda chases for you
          </h2>
          <p style={{ textAlign: "center", color: c.tm, fontSize: 14, margin: "0 0 32px" }}>
            We check in with you before every step. You're always in control.
          </p>
          {TIMELINE_PREVIEW.map((s, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 0",
              borderBottom: i < TIMELINE_PREVIEW.length - 1 ? `1px solid ${c.bdl}` : "none",
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%", background: s.col,
                flexShrink: 0, boxShadow: `0 0 0 3px ${s.col}20`,
              }} />
              <div style={{
                fontFamily: MONO, fontSize: 11, fontWeight: 700, color: s.col,
                width: isMobile ? 70 : 90, flexShrink: 0,
              }}>
                {s.day}
              </div>
              <div style={{ fontWeight: 500, fontSize: 13, color: c.tx }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Penalty breakdown */}
      <section style={{
        padding: isMobile ? "40px 20px" : "64px 48px",
        maxWidth: 600, margin: "0 auto", textAlign: "center",
      }}>
        <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: "0 0 8px" }}>
          What you're legally owed
        </h2>
        <p style={{ color: c.tm, fontSize: 14, margin: "0 0 24px" }}>
          Under the Late Payment of Commercial Debts (Interest) Act 1998
        </p>
        <div style={{
          background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 14,
          overflow: "hidden", textAlign: "left",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${c.bd}`, background: "#f8f9fb" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.04em" }}>Example: £3,000 invoice, 30 days late</span>
          </div>
          {[
            { label: "Original invoice", val: "£3,000.00", col: c.tx },
            { label: "Fixed penalty", val: "+ £40.00", col: c.or },
            { label: `Interest (30 days at ${getRate()}% p.a.)`, val: "+ £28.97", col: c.or },
          ].map((r) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${c.bdl}` }}>
              <span style={{ fontSize: 13, color: c.tm }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: r.col }}>{r.val}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", background: `${c.ac}08` }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: c.tx }}>Total owed to you</span>
            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, color: c.ac }}>£3,068.97</span>
          </div>
        </div>
        <button
          onClick={onCalculator}
          style={{
            display: "block", margin: "16px auto 0", background: "none", border: `1.5px solid ${c.ac}`,
            borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 600,
            color: c.ac, cursor: "pointer", fontFamily: FONT,
          }}
        >
          Try our free calculator with your own invoices →
        </button>
      </section>

      {/* CTA */}
      <section style={{
        padding: isMobile ? "40px 20px" : "64px 48px",
        textAlign: "center", background: c.ac,
      }}>
        <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
          You've done the work. Let Hielda make sure you're paid for it.
        </h2>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: "0 0 24px" }}>
          Protect the relationship. Enforce your rights. Never leave money on the table again.
        </p>
        <button
          onClick={onGetStarted}
          style={{
            background: "#fff", color: c.ac, border: "none", borderRadius: 10,
            padding: "14px 36px", fontSize: 16, fontWeight: 700, cursor: "pointer",
            fontFamily: FONT, boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          }}
        >
          Start Your Free Trial
        </button>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 10 }}>
          No credit card required · 7-day free trial
        </p>
      </section>

      {/* Footer */}
      <footer style={{
        padding: isMobile ? "24px 20px" : "24px 48px",
        borderTop: `1px solid ${c.bd}`, textAlign: "center",
        fontSize: 11, color: c.td,
        display: "flex", flexDirection: isMobile ? "column" : "row",
        justifyContent: "center", alignItems: "center", gap: isMobile ? 8 : 20,
      }}>
        <span>© {new Date().getFullYear()} Hielda. Protecting your pay.</span>
        <button
          onClick={onPrivacy}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 11, color: c.td, padding: 0, textDecoration: "underline" }}
        >
          Privacy Policy
        </button>
        <a href="mailto:support@hielda.com" style={{ color: c.td, fontSize: 11 }}>support@hielda.com</a>
      </footer>
    </div>
  )
}
