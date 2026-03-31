import { useState, useEffect } from "react"
import { supabase } from "../../supabase"
import { colors as c, FONT, MONO } from "../../constants"
import { fmt } from "../../utils"
import { Card, Spinner } from "../ui"

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

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner size={20} /></div>

  if (error) {
    return (
      <Card style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>💰</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.tx, marginBottom: 6 }}>Revenue Data</div>
        <p style={{ color: c.or, fontSize: 13 }}>{error}</p>
        <p style={{ color: c.tm, fontSize: 12, marginTop: 8 }}>
          Make sure the /api/admin-revenue endpoint is deployed with Stripe access.
        </p>
      </Card>
    )
  }

  if (!data) return null

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "MRR", value: fmt(data.mrr || 0), mono: true },
          { label: "Active Subs", value: data.active_subscriptions || 0 },
          { label: "Trialing", value: data.trialing || 0 },
          { label: "Churned", value: data.churned || 0, alert: (data.churned || 0) > 0 },
        ].map(s => (
          <div key={s.label} style={{ background: s.alert ? c.ord : c.sf, border: `1px solid ${s.alert ? c.or + "40" : c.bd}`, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: s.alert ? c.or : c.tm, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.alert ? c.or : c.tx, fontFamily: s.mono ? MONO : FONT }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Subscription breakdown */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
          Subscription Breakdown
        </h3>
        {(data.breakdown || []).map(b => (
          <div key={b.status} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${c.bdl}` }}>
            <span style={{ fontSize: 13, color: c.tx, textTransform: "capitalize" }}>{b.status}</span>
            <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 600, color: c.tx }}>{b.count}</span>
          </div>
        ))}
      </Card>

      {/* Recent payments */}
      {data.recent_payments?.length > 0 && (
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
            Recent Payments
          </h3>
          {data.recent_payments.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${c.bdl}`, fontSize: 12 }}>
              <span style={{ color: c.tx, flex: 1 }}>{p.email || p.customer}</span>
              <span style={{ fontFamily: MONO, fontWeight: 600, color: c.tx }}>{fmt(p.amount / 100)}</span>
              <span style={{ color: c.td }}>{new Date(p.created * 1000).toLocaleDateString("en-GB")}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 999,
                background: p.status === "paid" ? c.gnd : c.sf,
                color: p.status === "paid" ? c.gn : c.tm,
              }}>
                {p.status}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
