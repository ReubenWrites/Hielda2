import { useState, useCallback } from "react"
import { colors as c, FONT, MONO, getRate, getBoe } from "../constants"
import { calcInterest, penalty, fmt } from "../utils"
import { Card, Btn, ShieldLogo } from "./ui"
import { trackEvent } from "../posthog"
import { supabase } from "../supabase"

export default function Calculator({ onBack, onGetStarted, isMobile }) {
  const [amount, setAmount] = useState("")
  const [daysOverdue, setDaysOverdue] = useState("")
  const [leadEmail, setLeadEmail] = useState("")
  const [leadSent, setLeadSent] = useState(false)
  const [leadSending, setLeadSending] = useState(false)

  const parsedAmt = parseFloat(amount) || 0
  const parsedDays = parseInt(daysOverdue) || 0
  const hasInput = parsedAmt > 0 && parsedDays > 0

  const trackCalc = useCallback(() => {
    if (parsedAmt > 0 && parsedDays > 0) trackEvent("calculator_used", { amount: parsedAmt, days: parsedDays })
  }, [parsedAmt, parsedDays])

  const interest = hasInput ? calcInterest(parsedAmt, parsedDays) : 0
  const pen = hasInput ? penalty(parsedAmt) : 0
  const total = parsedAmt + interest + pen

  const penTier = parsedAmt >= 10000 ? "£100" : parsedAmt >= 1000 ? "£70" : "£40"

  const sendLeadEmail = async () => {
    if (!leadEmail.trim() || leadSent) return
    setLeadSending(true)
    try {
      await supabase.from("calculator_leads").insert({
        email: leadEmail.trim(),
        invoice_amount: parsedAmt,
        days_overdue: parsedDays,
        total_claimable: total,
      })
      trackEvent("calculator_lead_captured", { amount: parsedAmt, days: parsedDays, total })
      setLeadSent(true)
    } catch {
      // Non-critical — silently fail, don't interrupt the user
      setLeadSent(true)
    }
    setLeadSending(false)
  }

  return (
    <div style={{ fontFamily: FONT, color: c.tx, background: c.bg, minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "14px 20px" : "14px 48px",
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${c.bd}`,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={onBack}>
          <ShieldLogo size={28} />
          <span style={{ fontSize: 20, fontWeight: 700, color: c.ac, letterSpacing: "-0.02em" }}>Hielda</span>
        </div>
        <button
          onClick={onGetStarted}
          style={{
            background: c.ac, color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          Start Free Trial
        </button>
      </nav>

      {/* Header */}
      <section style={{
        padding: isMobile ? "40px 20px 24px" : "60px 48px 32px",
        textAlign: "center", maxWidth: 700, margin: "0 auto",
      }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", color: c.tm, cursor: "pointer", fontFamily: FONT, fontSize: 13, padding: 0, marginBottom: 20 }}
        >
          ← Back to home
        </button>
        <h1 style={{
          fontSize: isMobile ? 26 : 36, fontWeight: 700, color: c.tx,
          lineHeight: 1.15, margin: "0 0 10px", letterSpacing: "-0.02em",
        }}>
          UK Late Payment Calculator
        </h1>
        <p style={{ fontSize: isMobile ? 14 : 16, color: c.tm, lineHeight: 1.6, margin: "0 0 6px" }}>
          Calculate the statutory interest and penalties you're legally owed on overdue B2B invoices under UK law.
        </p>
        <p style={{ fontSize: 12, color: c.td }}>
          Based on the Late Payment of Commercial Debts (Interest) Act 1998
        </p>
      </section>

      {/* Calculator */}
      <section style={{
        padding: isMobile ? "0 20px 40px" : "0 48px 60px",
        maxWidth: 600, margin: "0 auto",
      }}>
        <Card style={{ padding: isMobile ? "24px 20px" : "32px 28px" }}>
          {/* Inputs */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.tx, marginBottom: 6 }}>
                Invoice amount
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: c.td, fontSize: 14, fontWeight: 600 }}>£</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: "100%", padding: "12px 14px 12px 30px",
                    background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 8,
                    fontFamily: MONO, fontSize: 16, color: c.tx, outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.tx, marginBottom: 6 }}>
                Days overdue
              </label>
              <input
                type="number"
                value={daysOverdue}
                onChange={(e) => setDaysOverdue(e.target.value)}
                onBlur={trackCalc}
                placeholder="e.g. 30"
                style={{
                  width: "100%", padding: "12px 14px",
                  background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 8,
                  fontFamily: MONO, fontSize: 16, color: c.tx, outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Results */}
          {hasInput && (
            <div style={{ borderTop: `1px solid ${c.bd}`, paddingTop: 20 }}>
              {[
                { label: "Original invoice", value: fmt(parsedAmt), color: c.tx },
                { label: `Fixed penalty (invoice ${penTier} tier)`, value: `+ ${fmt(pen)}`, color: "#d97706" },
                { label: `Interest (${parsedDays} days at ${getRate()}% p.a.)`, value: `+ ${fmt(interest)}`, color: "#d97706" },
              ].map((row) => (
                <div key={row.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: `1px solid ${c.bdl}`,
                }}>
                  <span style={{ fontSize: 13, color: c.tm }}>{row.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO, color: row.color }}>{row.value}</span>
                </div>
              ))}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "16px 0 8px",
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: c.tx }}>Total owed to you</span>
                <span style={{ fontSize: 24, fontWeight: 700, fontFamily: MONO, color: c.ac }}>{fmt(total)}</span>
              </div>
              <p style={{ fontSize: 11, color: c.td, marginTop: 4, marginBottom: 16 }}>
                Interest accrues daily. The longer they wait, the more you're owed.
              </p>

              {/* Lead capture */}
              {!leadSent ? (
                <div style={{ borderTop: `1px solid ${c.bd}`, paddingTop: 16 }}>
                  <p style={{ fontSize: 12, color: c.tx, fontWeight: 600, margin: "0 0 4px" }}>
                    Get this calculation emailed to you
                  </p>
                  <p style={{ fontSize: 11, color: c.tm, margin: "0 0 10px" }}>
                    We'll send a summary you can forward to your client, plus tips on claiming what you're owed.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendLeadEmail()}
                      placeholder="your@email.com"
                      style={{
                        flex: 1, padding: "9px 12px", background: c.bg, border: `1px solid ${c.bd}`,
                        borderRadius: 8, fontFamily: FONT, fontSize: 13, color: c.tx, outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      onClick={sendLeadEmail}
                      disabled={leadSending || !leadEmail.trim()}
                      style={{
                        background: c.ac, color: "#fff", border: "none", borderRadius: 8,
                        padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                        fontFamily: FONT, flexShrink: 0,
                        opacity: (!leadEmail.trim() || leadSending) ? 0.5 : 1,
                      }}
                    >
                      {leadSending ? "..." : "Send"}
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: c.td, margin: "6px 0 0" }}>No spam. Unsubscribe any time.</p>
                </div>
              ) : (
                <div style={{ borderTop: `1px solid ${c.bd}`, paddingTop: 14, textAlign: "center" }}>
                  <span style={{ fontSize: 13, color: c.gn, fontWeight: 600 }}>✓ Sent! Check your inbox.</span>
                </div>
              )}
            </div>
          )}

          {!hasInput && (
            <div style={{
              borderTop: `1px solid ${c.bd}`, paddingTop: 24,
              textAlign: "center", color: c.td, fontSize: 13,
            }}>
              Enter an amount and days overdue to see your calculation.
            </div>
          )}
        </Card>

        {/* Penalty tiers info */}
        <Card style={{ marginTop: 16, padding: isMobile ? "20px" : "24px 28px" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: c.tx, margin: "0 0 12px" }}>
            How it's calculated
          </h3>
          <div style={{ fontSize: 12, color: c.tm, lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 12px" }}>
              The <strong>Late Payment of Commercial Debts (Interest) Act 1998</strong> gives businesses the right to charge interest and a fixed penalty on overdue B2B invoices.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: c.bg, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, color: c.ac, fontSize: 13, marginBottom: 4 }}>Interest rate</div>
                <div style={{ fontSize: 12, color: c.tm }}>
                  Bank of England base rate ({getBoe()}%) + 8% = <strong style={{ color: c.tx }}>{getRate()}% per annum</strong>
                </div>
              </div>
              <div style={{ background: c.bg, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, color: c.ac, fontSize: 13, marginBottom: 4 }}>Fixed penalties</div>
                <div style={{ fontSize: 12, color: c.tm }}>
                  Under £1,000: <strong>£40</strong><br />
                  £1,000–£9,999: <strong>£70</strong><br />
                  £10,000+: <strong>£100</strong>
                </div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: c.td }}>
              These are your legal rights — not optional extras. Most freelancers never claim them.
            </p>
          </div>
        </Card>

        {/* CTA */}
        <div style={{
          marginTop: 24, textAlign: "center",
          padding: "28px 24px", background: c.ac, borderRadius: 14,
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>
            Stop leaving money on the table
          </h3>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "0 0 18px" }}>
            Hielda chases late invoices and enforces penalties automatically — so you don't have to.
          </p>
          <button
            onClick={onGetStarted}
            style={{
              background: "#fff", color: c.ac, border: "none", borderRadius: 10,
              padding: "12px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer",
              fontFamily: FONT, boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            }}
          >
            Start Free Trial
          </button>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 10, marginBottom: 0 }}>
            No credit card required · 7-day free trial
          </p>
        </div>
      </section>
    </div>
  )
}
