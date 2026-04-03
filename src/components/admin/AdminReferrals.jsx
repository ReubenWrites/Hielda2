import { useState, useEffect } from "react"
import { supabase } from "../../supabase"
import { fmt, formatDate } from "../../utils"
import { Card, Btn, Spinner } from "../ui"
import s from './AdminReferrals.module.css'

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
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "referrals", user_token: session?.access_token }),
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
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "referrals-update", user_token: session?.access_token, payout_id: payoutId, status: newStatus }),
      })
      if (!res.ok) throw new Error("Update failed")
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const pendingPayouts = payouts.filter(p => p.status === "pending")
  const approvedPayouts = payouts.filter(p => p.status === "approved")
  const totalPending = pendingPayouts.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalReferrals = referrals.length
  const eligibleCount = referrals.filter(r => r.status === "eligible" || r.status === "paid_out").length

  if (loading) return <div className={s.loading}><Spinner size={20} /></div>

  return (
    <div>
      {error && <div className={s.errorBox}>{error}</div>}

      {/* Stats */}
      <div className={s.statsGrid}>
        {[
          { label: "Total referrals", value: totalReferrals, mono: false, alert: false },
          { label: "Converted", value: eligibleCount, mono: false, alert: false },
          { label: "Pending payouts", value: pendingPayouts.length, mono: false, alert: pendingPayouts.length > 0 },
          { label: "Amount pending", value: fmt(totalPending), mono: true, alert: totalPending > 0 },
        ].map(stat => (
          <div key={stat.label} className={stat.alert ? s.statCardAlert : s.statCard}>
            <div className={stat.alert ? s.statLabelAlert : s.statLabel}>{stat.label}</div>
            <div className={stat.alert ? s.statValueAlert : (stat.mono ? s.statValueMono : s.statValue)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Pending payouts */}
      <Card style={{ marginBottom: 16 }}>
        <h3 className={s.sectionLabel}>
          Pending Payouts ({pendingPayouts.length})
        </h3>
        {pendingPayouts.length === 0 && (
          <div className={s.emptyState}>No pending payouts.</div>
        )}
        {pendingPayouts.map(p => (
          <div key={p.id} className={s.payoutRow}>
            <span className={s.payoutEmail}>{p.referrer_email || p.referrer_id}</span>
            <span className={s.payoutType}>{p.payout_type === "bonus" ? "Bonus" : "Referral"}</span>
            <span className={s.payoutAmount}>{fmt(p.amount)}</span>
            {p.bank_details?.sort_code && (
              <span className={s.payoutBankDetails}>
                {p.bank_details.sort_code} / {p.bank_details.account_number}
              </span>
            )}
            <div className={s.payoutActions}>
              <Btn sz="sm" onClick={() => updatePayout(p.id, "approved")}>Approve</Btn>
              <Btn sz="sm" v="ghost" onClick={() => updatePayout(p.id, "paid")}>Mark Paid</Btn>
            </div>
          </div>
        ))}
      </Card>

      {/* Approved (awaiting payment) */}
      {approvedPayouts.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h3 className={s.sectionLabel}>
            Approved — Awaiting Payment ({approvedPayouts.length})
          </h3>
          {approvedPayouts.map(p => (
            <div key={p.id} className={s.payoutRow}>
              <span className={s.payoutEmail}>{p.referrer_email || p.referrer_id}</span>
              <span className={s.payoutAmount}>{fmt(p.amount)}</span>
              {p.bank_details?.sort_code && (
                <span className={s.payoutBankDetails}>
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
        <h3 className={s.sectionLabel}>
          All Referrals ({referrals.length})
        </h3>
        {referrals.map(r => (
          <div key={r.id} className={s.referralRow}>
            <span className={s.referralEmail}>{r.referrer_email}</span>
            <span className={s.referralArrow}>→</span>
            <span className={s.referralEmail}>{r.referred_email || "Via link"}</span>
            <span className={s.referralSpent}>{fmt(r.total_spent || 0)}</span>
            <span
              className={s.referralBadge}
              style={{
                background: r.status === "eligible" || r.status === "paid_out" ? "var(--gnd)" : "var(--sf)",
                color: r.status === "eligible" || r.status === "paid_out" ? "var(--gn)" : "var(--tm)",
              }}
            >
              {r.status}
            </span>
          </div>
        ))}
      </Card>
    </div>
  )
}
