import { useState } from "react"
import { supabase } from "../supabase"
import { fmt, formatDate } from "../utils"
import { Card, Btn, Spinner } from "./ui"
import AdminMetrics from "./admin/AdminMetrics"
import AdminReferrals from "./admin/AdminReferrals"
import AdminRevenue from "./admin/AdminRevenue"
import s from './AdminDashboard.module.css'

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
    <span className={s.badge} style={{ background: bg || "var(--sf)", color: color || "var(--tm)", border: `1px solid ${color || "var(--bd)"}20` }}>
      {children}
    </span>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <span className={mono ? s.rowValueMono : s.rowValue}>{value ?? "—"}</span>
    </div>
  )
}

const ADMIN_TABS = [
  { id: "users", label: "Users" },
  { id: "metrics", label: "Metrics" },
  { id: "referrals", label: "Referrals" },
  { id: "revenue", label: "Revenue" },
]

export default function AdminDashboard({ isMobile }) {
  const [tab, setTab] = useState("users")
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
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", user_token: session?.access_token, lookup_email: email.trim() }),
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
    if (status === "active") return { color: "var(--gn)", bg: "var(--gnd)" }
    if (status === "trialing") return { color: "var(--ac)", bg: "var(--acd)" }
    if (status === "canceled" || status === "past_due") return { color: "var(--or)", bg: "var(--ord)" }
    return { color: "var(--tm)", bg: "var(--sf)" }
  }

  const invStatusColor = (status) => {
    if (status === "paid") return { color: "var(--gn)", bg: "var(--gnd)" }
    if (status === "overdue") return { color: "var(--or)", bg: "var(--ord)" }
    if (status === "pending") return { color: "var(--am)", bg: "var(--amd)" }
    return { color: "var(--tm)", bg: "var(--sf)" }
  }

  const deliveryColor = (ds) => {
    if (ds === "delivered") return { color: "var(--gn)", bg: "var(--gnd)" }
    if (ds === "bounced") return { color: "#991b1b", bg: "#fef2f2" }
    if (ds === "complained") return { color: "#92400e", bg: "#fffbeb" }
    if (ds === "pending") return { color: "var(--td)", bg: "var(--sf)" }
    return null
  }

  const hasProblem = (inv) => {
    const logs = data?.chase_logs?.filter(l => l.invoice_id === inv.id) || []
    return logs.some(l => l.delivery_status === "bounced" || l.delivery_status === "complained")
  }

  const totalOutstanding = data?.invoices
    ?.filter(i => i.status !== "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0) || 0

  const overdueCount = data?.invoices?.filter(i => i.status === "overdue").length || 0
  const bouncedCount = data?.chase_logs?.filter(l => l.delivery_status === "bounced").length || 0

  return (
    <div>
      <h1 className={s.title}>Admin Dashboard</h1>
      <p className={s.subtitle}>Manage users, track metrics, and oversee referrals.</p>

      {/* Tabs */}
      <div className={s.tabs}>
        {ADMIN_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`${s.tab} ${tab === t.id ? s.tabActive : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "metrics" && <AdminMetrics isMobile={isMobile} />}
      {tab === "referrals" && <AdminReferrals isMobile={isMobile} />}
      {tab === "revenue" && <AdminRevenue isMobile={isMobile} />}

      {tab === "users" && <>
      {/* Search */}
      <Card style={{ marginBottom: 24 }}>
        <div className={s.searchRow}>
          <div className={s.searchInputWrap}>
            <label className={s.searchLabel}>User email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookup()}
              placeholder="user@example.com"
              className={s.searchInput}
            />
          </div>
          <Btn onClick={lookup} dis={loading || !email.trim()}>
            {loading ? <Spinner size={14} /> : "Look up"}
          </Btn>
        </div>
        {error && <div className={s.errorBox}>{error}</div>}
      </Card>

      {data && (
        <div>
          {/* Summary bar */}
          <div className={s.statsGrid}>
            {[
              { label: "Total invoices", value: data.invoices.length, alert: false },
              { label: "Overdue", value: overdueCount, alert: overdueCount > 0 },
              { label: "Outstanding", value: fmt(totalOutstanding), mono: true, alert: false },
              { label: "Bounced emails", value: bouncedCount, alert: bouncedCount > 0 },
            ].map(stat => (
              <div key={stat.label} className={stat.alert ? s.statCardAlert : s.statCard}>
                <div className={stat.alert ? s.statLabelAlert : s.statLabel}>{stat.label}</div>
                <div className={stat.alert ? s.statValueAlert : (stat.mono ? s.statValueMono : s.statValue)}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div className={s.twoColGrid}>
            {/* User & Profile */}
            <Card>
              <h3 className={s.sectionLabel}>Account</h3>
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
              <h3 className={s.sectionLabel}>Subscription</h3>
              {data.subscription ? (
                <>
                  <div className={s.subBadgeRow}>
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
                <div className={s.noSub}>No subscription record found.</div>
              )}
            </Card>
          </div>

          {/* Invoices */}
          <Card>
            <h3 className={s.sectionLabelLg}>
              Invoices ({data.invoices.length})
            </h3>
            {data.invoices.length === 0 && (
              <div className={s.noInvoices}>No invoices yet.</div>
            )}
            {data.invoices.map(inv => {
              const logs = data.chase_logs.filter(l => l.invoice_id === inv.id)
              const problem = hasProblem(inv)
              const isExpanded = expandedInv === inv.id
              return (
                <div key={inv.id} className={s.invoiceBorder}>
                  <button
                    onClick={() => setExpandedInv(isExpanded ? null : inv.id)}
                    className={s.invoiceBtn}
                  >
                    {problem && <span title="Delivery problem">⚠️</span>}
                    <span className={s.invoiceRef}>{inv.ref}</span>
                    <span className={s.invoiceClient}>{inv.client_name}</span>
                    <span className={s.invoiceAmount}>{fmt(inv.amount)}</span>
                    <Badge {...invStatusColor(inv.status)}>{inv.status}</Badge>
                    <span className={s.invoiceToggle}>{isExpanded ? "▲" : "▼"}</span>
                  </button>

                  {isExpanded && (
                    <div className={s.expandedInvoice}>
                      <div className={s.invoiceDetailGrid}>
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
                          <div className={s.chaseLogTitle}>
                            Chase log ({logs.length})
                          </div>
                          {logs.map(log => {
                            const dc = deliveryColor(log.delivery_status)
                            return (
                              <div key={log.id} className={s.chaseLogRow}>
                                <span className={s.chaseLogStage}>
                                  {log.status === "check_in_sent" ? "Check-in" : (CHASE_STAGE_LABELS[log.chase_stage] || log.chase_stage)}
                                </span>
                                {dc && (
                                  <Badge color={dc.color} bg={dc.bg}>{log.delivery_status}</Badge>
                                )}
                                <span className={s.chaseLogDate}>{formatDate(log.sent_at)}</span>
                                {log.resend_id && (
                                  <span className={s.chaseLogResendId}>{log.resend_id}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {logs.length === 0 && (
                        <div className={s.noChase}>No chase emails sent yet.</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </Card>
        </div>
      )}
      </>}
    </div>
  )
}
