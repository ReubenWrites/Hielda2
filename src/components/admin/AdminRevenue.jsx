import { useState, useEffect } from "react"
import { supabase } from "../../supabase"
import { fmt } from "../../utils"
import { Card, Spinner } from "../ui"
import s from './AdminRevenue.module.css'

export default function AdminRevenue({ isMobile }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    loadRevenue()
  }, [])

  const loadRevenue = async () => {
    setLoading(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/admin-revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_token: session?.access_token }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load")
      setData(json)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (loading) return <div className={s.loading}><Spinner size={20} /></div>

  if (error) {
    return (
      <Card style={{ textAlign: "center", padding: 40 }}>
        <div className={s.errorIcon}>💰</div>
        <div className={s.errorTitle}>Revenue Data</div>
        <p className={s.errorText}>{error}</p>
        <p className={s.errorHint}>
          Make sure the /api/admin-revenue endpoint is deployed with Stripe access.
        </p>
      </Card>
    )
  }

  if (!data) return null

  return (
    <div>
      {/* Stats */}
      <div className={s.statsGrid}>
        {[
          { label: "MRR", value: fmt(data.mrr || 0), mono: true, alert: false },
          { label: "Active Subs", value: data.active_subscriptions || 0, mono: false, alert: false },
          { label: "Trialing", value: data.trialing || 0, mono: false, alert: false },
          { label: "Churned", value: data.churned || 0, mono: false, alert: (data.churned || 0) > 0 },
        ].map(stat => (
          <div key={stat.label} className={stat.alert ? s.statCardAlert : s.statCard}>
            <div className={stat.alert ? s.statLabelAlert : s.statLabel}>{stat.label}</div>
            <div className={stat.alert ? s.statValueAlert : (stat.mono ? s.statValueMono : s.statValue)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Subscription breakdown */}
      <Card style={{ marginBottom: 16 }}>
        <h3 className={s.sectionLabel}>
          Subscription Breakdown
        </h3>
        {(data.breakdown || []).map(b => (
          <div key={b.status} className={s.breakdownRow}>
            <span className={s.breakdownStatus}>{b.status}</span>
            <span className={s.breakdownCount}>{b.count}</span>
          </div>
        ))}
      </Card>

      {/* Recent payments */}
      {data.recent_payments?.length > 0 && (
        <Card>
          <h3 className={s.sectionLabel}>
            Recent Payments
          </h3>
          {data.recent_payments.map((p, i) => (
            <div key={i} className={s.paymentRow}>
              <span className={s.paymentEmail}>{p.email || p.customer}</span>
              <span className={s.paymentAmount}>{fmt(p.amount / 100)}</span>
              <span className={s.paymentDate}>{new Date(p.created * 1000).toLocaleDateString("en-GB")}</span>
              <span
                className={s.paymentBadge}
                style={{
                  background: p.status === "paid" ? "var(--gnd)" : "var(--sf)",
                  color: p.status === "paid" ? "var(--gn)" : "var(--tm)",
                }}
              >
                {p.status}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
