import { useEffect } from "react"
import { colors as c, FONT, MONO, getRate, getBoe } from "../constants"
import { ShieldLogo } from "./ui"

const LANDING_FAQS = [
  {
    q: "My client hasn't paid my invoice — what can I do?",
    a: "Under the Late Payment of Commercial Debts Act 1998, you have the legal right to charge statutory interest at 8% above the Bank of England base rate, plus a fixed penalty of £40–£100 on every overdue B2B invoice. You can send formal chase emails, add these charges automatically, and escalate to a legal notice if needed. Hielda automates this entire process so you never have to ask awkwardly for your own money.",
  },
  {
    q: "How long can a client legally take to pay an invoice in the UK?",
    a: "By default, payment is due within 30 days for business-to-business transactions. If no payment terms are agreed, the 30-day statutory period applies automatically. Once that period expires, the invoice is legally overdue and statutory interest begins to accrue daily.",
  },
  {
    q: "Can I charge interest on an overdue invoice in the UK?",
    a: "Yes. Under the Late Payment of Commercial Debts Act 1998, you are legally entitled to charge interest at 8% above the Bank of England base rate on any overdue B2B invoice. This right applies automatically — you don't need to have stated it on your original invoice or in your contract.",
  },
  {
    q: "What late payment penalties can I charge?",
    a: "The Act entitles you to a fixed debt recovery cost on top of interest: £40 for invoices under £1,000, £70 for invoices between £1,000 and £9,999, and £100 for invoices of £10,000 or more. These apply per invoice, in addition to the daily interest that accrues.",
  },
  {
    q: "How do I chase a late invoice without damaging the client relationship?",
    a: "The key is separating the personal relationship from the commercial process. Your client receives formal notices from a third party acting on your behalf — it's not personal, it's just business. This is exactly how large companies operate: the person who commissioned your work and the accounts department are completely separate teams. You stay the good guy; Hielda handles the uncomfortable part.",
  },
  {
    q: "Does the Late Payment Act apply to my invoices?",
    a: "The Act applies to business-to-business (B2B) transactions — both parties must be acting in the course of a business. It does not cover invoices to consumers. It applies throughout the UK and covers most commercial contracts, including freelance and contractor work.",
  },
  {
    q: "Why is Hielda better than just chasing clients myself?",
    a: "When you chase a client yourself, you're asking a favour from someone whose goodwill you depend on. Every email you send puts you in an awkward position — too soft and they ignore it, too firm and you risk the relationship. Hielda removes you from the equation entirely. Your client hears from a third party acting on your behalf, which carries far more weight and creates no personal friction. You stay professional, they feel the pressure, and you never have to have an uncomfortable conversation.",
  },
  {
    q: "How does Hielda protect me from blowback from my client?",
    a: "Hielda acts as your outsourced accounts team — a third party that handles all the chasing and applies charges on your behalf. Your client receives formal notices from that third party, not from you personally. This gives them a face-saving way to pay without either of you having to acknowledge an awkward dynamic. If a client pushes back, you can truthfully say 'my outsourced accounting team applies those charges automatically to anyone who pays late — it's nothing personal.' That's a very different conversation from having to ask for your money yourself.",
  },
  {
    q: "Is it true that companies really delay payment on purpose?",
    a: "Yes — and it's well documented. Large companies routinely use extended payment terms (60, 90, even 120 days) as a cash flow management strategy, effectively using suppliers as interest-free lenders. A 2023 report by the Federation of Small Businesses found that 52% of UK small businesses were paid late, with the average overdue amount exceeding £8,500. For large businesses, delaying payment to freelancers and SMEs is a deliberate financial decision made by accounts departments — the person who hired you often has no idea it's happening.",
  },
]

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
  useEffect(() => {
    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.id = "faq-schema-landing"
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": LANDING_FAQS.map(({ q, a }) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a },
      })),
    })
    document.head.appendChild(script)
    return () => document.getElementById("faq-schema-landing")?.remove()
  }, [])

  return (
    <main style={{ fontFamily: FONT, color: c.tx, background: c.bg, minHeight: "100vh" }}>
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

      {/* Pricing */}
      <section style={{
        padding: isMobile ? "40px 20px" : "64px 48px",
        maxWidth: 700, margin: "0 auto", textAlign: "center",
      }}>
        <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: "0 0 8px" }}>
          Simple, transparent pricing
        </h2>
        <p style={{ color: c.tm, fontSize: 14, margin: "0 0 32px" }}>
          One late fee more than covers a year's subscription. Everything after that is profit.
        </p>
        <div style={{
          display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 16, textAlign: "left",
        }}>
          {/* Monthly */}
          <div style={{
            background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 16,
            padding: "28px 24px",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Monthly</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 38, fontWeight: 700, color: c.tx, fontFamily: MONO }}>£3.99</span>
              <span style={{ fontSize: 13, color: c.td }}>/month</span>
            </div>
            <p style={{ fontSize: 12, color: c.tm, margin: "0 0 20px", lineHeight: 1.5 }}>
              Cancel anytime. No lock-in.
            </p>
            <button onClick={onGetStarted} style={{
              width: "100%", background: c.ac, color: "#fff", border: "none", borderRadius: 10,
              padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
            }}>
              Start 7-day free trial
            </button>
          </div>

          {/* Annual */}
          <div style={{
            background: "#fff", border: `2px solid ${c.ac}`, borderRadius: 16,
            padding: "28px 24px", position: "relative",
          }}>
            <div style={{
              position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
              background: c.ac, color: "#fff", fontSize: 10, fontWeight: 700,
              padding: "4px 14px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}>
              Best value
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Annual</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 38, fontWeight: 700, color: c.tx, fontFamily: MONO }}>£34.99</span>
              <span style={{ fontSize: 13, color: c.td }}>/year</span>
            </div>
            <p style={{ fontSize: 12, color: c.tm, margin: "0 0 4px" }}>
              Just £2.92/month — save 27%
            </p>
            <p style={{ fontSize: 12, color: "#16a34a", margin: "0 0 20px", fontStyle: "italic" }}>
              One recovered penalty covers your whole year.
            </p>
            <button onClick={onGetStarted} style={{
              width: "100%", background: c.ac, color: "#fff", border: "none", borderRadius: 10,
              padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
            }}>
              Start 7-day free trial
            </button>
          </div>
        </div>

        {/* Included features */}
        <div style={{ marginTop: 20, padding: "20px 24px", background: c.sf, borderRadius: 12, textAlign: "left" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.tx, marginBottom: 12 }}>Everything included in both plans:</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "6px 20px" }}>
            {[
              "19-stage automated chase sequence",
              "Statutory interest & penalty enforcement",
              "PDF invoice generation",
              "Chase history & audit trail",
              "You stay in full control — we check in first",
              "Email support",
            ].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: c.tx }}>
                <span style={{ color: c.gn, fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 11, color: c.td, marginTop: 14 }}>
          No credit card required to start · Cancel any time · UK businesses only
        </p>
      </section>

      {/* FAQ */}
      <section style={{ padding: isMobile ? "40px 20px" : "64px 48px", maxWidth: 860, margin: "0 auto" }}>
        <h2 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: "0 0 6px", textAlign: "center" }}>
          Common questions about late payment
        </h2>
        <p style={{ color: c.tm, fontSize: 14, textAlign: "center", margin: "0 0 32px" }}>
          Everything you need to know about your rights as a UK freelancer or small business.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {LANDING_FAQS.map(({ q, a }) => (
            <div key={q} style={{ background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 10, padding: isMobile ? "16px 18px" : "18px 24px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.tx, margin: "0 0 8px", lineHeight: 1.4 }}>{q}</h3>
              <p style={{ fontSize: 13, color: c.tm, margin: 0, lineHeight: 1.7 }}>{a}</p>
            </div>
          ))}
        </div>
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
    </main>
  )
}
