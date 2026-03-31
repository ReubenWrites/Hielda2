import { useState, useEffect } from "react"
import { supabase } from "../../supabase"
import { colors as c, FONT, MONO } from "../../constants"
import { fmt, formatDate } from "../../utils"
import { Card, Btn, Spinner } from "../ui"

export default function AdminReferrals({ isMobile }) {
  const [payouts, setPayouts] = useState([])
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/admin-referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_token: session?.access_token }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load")
      setPayouts(json.payouts || [])
      setReferrals(json.referrals || [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updatePayout = async (payoutId, newStatus) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/admin-referrals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_token: session?.access_token, payout_id: payoutId, status: newStatus }),
      })
      if (!res.ok) throw new Error("Update failed")
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const pendingPayouts = payouts.filter(p => p.status === "pending")
  const approvedPayouts = payouts.filter(p => p.status === "approved")
  const totalPending = pendingPayouts.reduce((s, p) => s + Number(p.amount), 0)
  const totalReferrals = referrals.length
  const eligibleCount = referrals.filter(r => r.status === "eligible" || r.status === "paid_out").length

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner size={20} /></div>

  return (
    <div>
      {error && (
        <div style={{ padding: "10px 14px", background: c.ord, color: c.or, borderRadius: 8, fontSize: 12, marginBottom: 16 }}>{error}</div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total referrals", value: totalReferrals },
          { label: "Converted", value: eligibleCount },
          { label: "Pending payouts", value: pendingPayouts.length, alert: pendingPayouts.length > 0 },
          { label: "Amount pending", value: fmt(totalPending), mono: true, alert: totalPending > 0 },
        ].map(s => (
          <div key={s.label} style={{ background: s.alert ? c.ord : c.sf, border: `1px solid ${s.alert ? c.or + "40" : c.bd}`, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: s.alert ? c.or : c.tm, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.alert ? c.or : c.tx, fontFamily: s.mono ? MONO : FONT }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending payouts */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
          Pending Payouts ({pendingPayouts.length})
        </h3>
        {pendingPayouts.length === 0 && (
          <div style={{ fontSize: 13, color: c.td }}>No pending payouts.</div>
        )}
        {pendingPayouts.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${c.bdl}`, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: c.tx, flex: 1 }}>{p.referrer_email || p.referrer_id}</span>
            <span style={{ fontSize: 12, color: c.tm }}>{p.payout_type === "bonus" ? "Bonus" : "Referral"}</span>
            <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 600, color: c.tx }}>{fmt(p.amount)}</span>
            {p.bank_details?.sort_code && (
              <span style={{ fontSize: 10, fontFamily: MONO, color: c.td }}>
                {p.bank_details.sort_code} / {p.bank_details.account_number}
              </span>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <Btn sz="sm" onClick={() => updatePayout(p.id, "approved")}>Approve</Btn>
              <Btn sz="sm" v="ghost" onClick={() => updatePayout(p.id, "paid")}>Mark Paid</Btn>
            </div>
          </div>
        ))}
      </Card>

      {/* Approved (awaiting payment) */}
      {approvedPayouts.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
            Approved — Awaiting Payment ({approvedPayouts.length})
          </h3>
          {approvedPayouts.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${c.bdl}`, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: c.tx, flex: 1 }}>{p.referrer_email || p.referrer_id}</span>
              <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 600 }}>{fmt(p.amount)}</span>
              {p.bank_details?.sort_code && (
                <span style={{ fontSize: 10, fontFamily: MONO, color: c.td }}>
                  {p.bank_details.bank_name} {p.bank_details.sort_code} / {p.bank_details.account_number} ({p.bank_details.account_name})
                </span>
              )}
              <Btn sz="sm" onClick={() => updatePayout(p.id, "paid")}>Mark Paid</Btn>
            </div>
          ))}
        </Card>
      )}

      {/* All referrals */}
      <Card>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
          All Referrals ({referrals.length})
        </h3>
        {referrals.map(r => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${c.bdl}`, fontSize: 12, flexWrap: "wrap" }}>
            <span style={{ color: c.tx, flex: 1, minWidth: 120 }}>{r.referrer_email}</span>
            <span style={{ color: c.tm }}>→</span>
            <span style={{ color: c.tx, flex: 1, minWidth: 120 }}>{r.referred_email || "Via link"}</span>
            <span style={{ fontFamily: MONO, color: c.tm, minWidth: 60 }}>{fmt(r.total_spent || 0)}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 999,
              background: r.status === "eligible" || r.status === "paid_out" ? c.gnd : c.sf,
              color: r.status === "eligible" || r.status === "paid_out" ? c.gn : c.tm,
            }}>
              {r.status}
            </span>
          </div>
        ))}
      </Card>
    </div>
  )
}
