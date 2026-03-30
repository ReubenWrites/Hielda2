import { useState } from "react"
import { supabase } from "../supabase"
import { colors as c, FONT, MONO } from "../constants"
import { fmt, formatDate } from "../utils"
import { Card, Btn, Spinner } from "./ui"

const CHASE_STAGE_LABELS = {
  reminder_1: "Friendly Reminder", reminder_2: "Second Reminder", final_warning: "Final Warning",
  first_chase: "First Chase", second_chase: "Second Chase", third_chase: "Third Chase",
  chase_4: "Chase 4", chase_5: "Chase 5", chase_6: "Chase 6", chase_7: "Chase 7",
  chase_8: "Chase 8", chase_9: "Chase 9", chase_10: "Chase 10", chase_11: "Chase 11",
  escalation_1: "Escalation 1", escalation_2: "Escalation 2", escalation_3: "Escalation 3",
  escalation_4: "Escalation 4", final_notice: "Final Notice",
}

function Badge({ children, color, bg }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: bg || c.sf, color: color || c.tm, border: `1px solid ${color || c.bd}20` }}>
      {children}
    </span>
  )
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${c.bdl}`, gap: 12 }}>
      <span style={{ fontSize: 12, color: c.tm, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: c.tx, fontWeight: 500, textAlign: "right", fontFamily: mono ? MONO : FONT, wordBreak: "break-all" }}>{value ?? "—"}</span>
    </div>
  )
}

export default function AdminDashboard({ isMobile }) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState(null)
  const [expandedInv, setExpandedInv] = useState(null)

  const lookup = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError("")
    setData(null)
    setExpandedInv(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/admin-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_token: session?.access_token, lookup_email: email.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Lookup failed")
      setData(json)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const subStatusColor = (status) => {
    if (status === "active") return { color: c.gn, bg: c.gnd }
    if (status === "trialing") return { color: c.ac, bg: c.acd }
    if (status === "canceled" || status === "past_due") return { color: c.or, bg: c.ord }
    return { color: c.tm, bg: c.sf }
  }

  const invStatusColor = (status) => {
    if (status === "paid") return { color: c.gn, bg: c.gnd }
    if (status === "overdue") return { color: c.or, bg: c.ord }
    if (status === "pending") return { color: c.am, bg: c.amd }
    return { color: c.tm, bg: c.sf }
  }

  const deliveryColor = (ds) => {
    if (ds === "delivered") return { color: c.gn, bg: c.gnd }
    if (ds === "bounced") return { color: "#991b1b", bg: "#fef2f2" }
    if (ds === "complained") return { color: "#92400e", bg: "#fffbeb" }
    if (ds === "pending") return { color: c.td, bg: c.sf }
    return null
  }

  const hasProblem = (inv) => {
    const logs = data?.chase_logs?.filter(l => l.invoice_id === inv.id) || []
    return logs.some(l => l.delivery_status === "bounced" || l.delivery_status === "complained")
  }

  const totalOutstanding = data?.invoices
    ?.filter(i => i.status !== "paid")
    .reduce((s, i) => s + Number(i.amount), 0) || 0

  const overdueCount = data?.invoices?.filter(i => i.status === "overdue").length || 0
  const bouncedCount = data?.chase_logs?.filter(l => l.delivery_status === "bounced").length || 0

  return (
    <div>
      <h1 style={{ fontSize: 21, fontWeight: 700, color: c.tx, margin: "0 0 4px" }}>Support Dashboard</h1>
      <p style={{ color: c.tm, fontSize: 13, margin: "0 0 24px" }}>Look up any user account by email address.</p>

      {/* Search */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.tm, display: "block", marginBottom: 5 }}>User email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookup()}
              placeholder="user@example.com"
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${c.bd}`, borderRadius: 8, fontFamily: FONT, fontSize: 13, color: c.tx, background: c.bg, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <Btn onClick={lookup} dis={loading || !email.trim()}>
            {loading ? <Spinner size={14} /> : "Look up"}
          </Btn>
        </div>
        {error && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: c.ord, color: c.or, borderRadius: 8, fontSize: 12 }}>
            {error}
          </div>
        )}
      </Card>

      {data && (
        <div>
          {/* Summary bar */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total invoices", value: data.invoices.length },
              { label: "Overdue", value: overdueCount, alert: overdueCount > 0 },
              { label: "Outstanding", value: fmt(totalOutstanding), mono: true },
              { label: "Bounced emails", value: bouncedCount, alert: bouncedCount > 0 },
            ].map(stat => (
              <div key={stat.label} style={{ background: stat.alert ? c.ord : c.sf, border: `1px solid ${stat.alert ? c.or + "40" : c.bd}`, borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: stat.alert ? c.or : c.tm, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: stat.alert ? c.or : c.tx, fontFamily: stat.mono ? MONO : FONT }}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* User & Profile */}
            <Card>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Account</h3>
              <Row label="Name" value={data.profile?.full_name} />
              <Row label="Business" value={data.profile?.business_name} />
              <Row label="Email" value={data.user.email} />
              <Row label="Joined" value={data.user.created_at ? formatDate(data.user.created_at) : "—"} />
              <Row label="Last sign in" value={data.user.last_sign_in_at ? formatDate(data.user.last_sign_in_at) : "Never"} />
              <Row label="Onboarding" value={data.profile?.onboarding_complete ? "Complete" : "Incomplete"} />
              <Row label="Payment details" value={data.profile?.sort_code && data.profile?.account_number ? "Set up" : "Missing"} />
              <Row label="Default terms" value={data.profile?.default_payment_terms ? `${data.profile.default_payment_terms} days` : "—"} />
            </Card>

            {/* Subscription */}
            <Card>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Subscription</h3>
              {data.subscription ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Badge {...subStatusColor(data.subscription.status)}>
                      {data.subscription.status || "Unknown"}
                    </Badge>
                  </div>
                  <Row label="Plan" value={data.subscription.plan || "—"} />
                  <Row label="Trial ends" value={data.subscription.trial_end ? formatDate(data.subscription.trial_end) : "—"} />
                  <Row label="Period end" value={data.subscription.current_period_end ? formatDate(data.subscription.current_period_end) : "—"} />
                  <Row label="Stripe customer" value={data.subscription.stripe_customer_id} mono />
                  <Row label="Stripe sub ID" value={data.subscription.stripe_subscription_id} mono />
                </>
              ) : (
                <div style={{ fontSize: 13, color: c.td, padding: "8px 0" }}>No subscription record found.</div>
              )}
            </Card>
          </div>

          {/* Invoices */}
          <Card>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
              Invoices ({data.invoices.length})
            </h3>
            {data.invoices.length === 0 && (
              <div style={{ fontSize: 13, color: c.td }}>No invoices yet.</div>
            )}
            {data.invoices.map(inv => {
              const logs = data.chase_logs.filter(l => l.invoice_id === inv.id)
              const problem = hasProblem(inv)
              const isExpanded = expandedInv === inv.id
              return (
                <div key={inv.id} style={{ borderBottom: `1px solid ${c.bdl}`, marginBottom: 0 }}>
                  <button
                    onClick={() => setExpandedInv(isExpanded ? null : inv.id)}
                    style={{
                      width: "100%", padding: "10px 0", background: "none", border: "none",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                      fontFamily: FONT, textAlign: "left",
                    }}
                  >
                    {problem && <span title="Delivery problem">⚠️</span>}
                    <span style={{ fontSize: 12, fontFamily: MONO, color: c.ac, width: 90, flexShrink: 0 }}>{inv.ref}</span>
                    <span style={{ fontSize: 12, color: c.tx, flex: 1 }}>{inv.client_name}</span>
                    <span style={{ fontSize: 12, fontFamily: MONO, color: c.tx, width: 80, textAlign: "right" }}>{fmt(inv.amount)}</span>
                    <Badge {...invStatusColor(inv.status)}>{inv.status}</Badge>
                    <span style={{ fontSize: 11, color: c.td, width: 14 }}>{isExpanded ? "▲" : "▼"}</span>
                  </button>

                  {isExpanded && (
                    <div style={{ paddingBottom: 14, paddingLeft: 4 }}>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
                        <div>
                          <Row label="Client email" value={inv.client_email} />
                          <Row label="Description" value={inv.description} />
                          <Row label="Issued" value={formatDate(inv.issue_date)} />
                          <Row label="Due" value={formatDate(inv.due_date)} />
                          <Row label="Terms" value={`${inv.payment_term_days} days`} />
                        </div>
                        <div>
                          <Row label="Chase stage" value={CHASE_STAGE_LABELS[inv.chase_stage] || inv.chase_stage || "Not started"} />
                          <Row label="Auto chase" value={inv.auto_chase === false ? "Paused" : "Active"} />
                          <Row label="No fines" value={inv.no_fines ? "Yes" : "No"} />
                          <Row label="Send method" value={inv.send_method || "—"} />
                          <Row label="Created" value={formatDate(inv.created_at)} />
                        </div>
                      </div>

                      {/* Chase log */}
                      {logs.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                            Chase log ({logs.length})
                          </div>
                          {logs.map(log => {
                            const dc = deliveryColor(log.delivery_status)
                            return (
                              <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: `1px solid ${c.bdl}`, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, color: c.tx, flex: 1 }}>
                                  {log.status === "check_in_sent" ? "Check-in" : (CHASE_STAGE_LABELS[log.chase_stage] || log.chase_stage)}
                                </span>
                                {dc && (
                                  <Badge color={dc.color} bg={dc.bg}>{log.delivery_status}</Badge>
                                )}
                                <span style={{ fontSize: 11, color: c.td }}>{formatDate(log.sent_at)}</span>
                                {log.resend_id && (
                                  <span style={{ fontSize: 10, color: c.td, fontFamily: MONO }}>{log.resend_id}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {logs.length === 0 && (
                        <div style={{ fontSize: 12, color: c.td }}>No chase emails sent yet.</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </Card>
        </div>
      )}
    </div>
  )
}
