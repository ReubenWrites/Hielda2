import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import { colors as c, FONT, MONO, REFERRAL_STATUSES, REFERRAL_THRESHOLD, REFERRAL_REWARD, REFERRAL_BONUS_COUNT, REFERRAL_BONUS_AMOUNT } from "../constants"
import { fmt } from "../utils"
import { Card, Btn, Inp, ErrorBanner } from "./ui"
import { trackEvent } from "../posthog"

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return `HIELDA-${code}`
}

export default function Referrals({ profile, userId, isMobile }) {
  const [referrals, setReferrals] = useState([])
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState(profile?.referral_code || "")

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    setLoading(true)
    // Ensure user has a referral code
    let myCode = profile?.referral_code
    if (!myCode) {
      myCode = generateCode()
      await supabase.from("profiles").update({ referral_code: myCode }).eq("id", userId)
      setCode(myCode)
    } else {
      setCode(myCode)
    }

    const [{ data: refs }, { data: pays }] = await Promise.all([
      supabase.from("referrals").select("*").eq("referrer_id", userId).order("created_at", { ascending: false }),
      supabase.from("referral_payouts").select("*").eq("referrer_id", userId).order("created_at", { ascending: false }),
    ])
    setReferrals(refs || [])
    setPayouts(pays || [])
    setLoading(false)
  }

  const referralLink = `https://hielda.com/ref/${code}`

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    trackEvent("referral_link_copied")
    setTimeout(() => setCopied(false), 2000)
  }

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setSending(true)
    setError("")
    try {
      const { error: dbErr } = await supabase.from("referrals").insert({
        referrer_id: userId,
        referral_code: code,
        referred_email: inviteEmail.trim(),
        status: "link_sent",
      })
      if (dbErr) throw dbErr
      trackEvent("referral_invite_sent")
      setInviteEmail("")
      loadData()
    } catch (e) {
      setError("Failed to create referral: " + e.message)
    }
    setSending(false)
  }

  const eligibleCount = referrals.filter(r => r.status === "eligible" || r.status === "paid_out").length
  const bonusEarned = eligibleCount >= REFERRAL_BONUS_COUNT
  const totalEarned = (payouts.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0))
  const pendingPayout = payouts.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0)

  const getStatusMessage = (ref) => {
    const s = REFERRAL_STATUSES[ref.status]
    if (ref.status === "subscribed") {
      const spent = Number(ref.total_spent) || 0
      const remaining = REFERRAL_THRESHOLD - spent
      if (remaining <= 0) return "Eligible soon"
      const monthsLeft = Math.ceil(remaining / 3.99)
      return `${fmt(spent)}/${fmt(REFERRAL_THRESHOLD)} spent — ~${monthsLeft} month${monthsLeft !== 1 ? "s" : ""} to go`
    }
    return s?.desc || ""
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: c.tm, fontSize: 13 }}>Loading referrals...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.tx, margin: "0 0 5px" }}>Refer & Earn</h1>
        <p style={{ color: c.tm, margin: 0, fontSize: 13 }}>
          Earn {fmt(REFERRAL_REWARD)} for every friend who subscribes and spends {fmt(REFERRAL_THRESHOLD)} with Hielda. Get {REFERRAL_BONUS_COUNT} referrals and earn an extra {fmt(REFERRAL_BONUS_AMOUNT)} bonus.
        </p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Referrals", value: referrals.length },
          { label: "Eligible", value: eligibleCount },
          { label: "Earned", value: fmt(totalEarned), mono: true },
          { label: "Pending", value: fmt(pendingPayout), mono: true },
        ].map(s => (
          <div key={s.label} style={{ background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: c.tm, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.tx, fontFamily: s.mono ? MONO : FONT }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Share link */}
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: "0 0 12px" }}>Your Referral Link</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              readOnly
              value={referralLink}
              style={{
                flex: 1, padding: "9px 12px", background: c.bg, border: `1px solid ${c.bd}`,
                borderRadius: 8, fontFamily: MONO, fontSize: 11, color: c.tx, outline: "none",
                boxSizing: "border-box",
              }}
            />
            <Btn onClick={copyLink} sz="sm">{copied ? "Copied!" : "Copy"}</Btn>
          </div>
          <p style={{ fontSize: 11, color: c.td, margin: 0 }}>Share this link with anyone. When they sign up and spend {fmt(REFERRAL_THRESHOLD)}, you earn {fmt(REFERRAL_REWARD)}.</p>
        </Card>

        {/* Invite by email */}
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: "0 0 12px" }}>Invite by Email</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Inp label="" value={inviteEmail} onChange={setInviteEmail} ph="friend@email.com" type="email" />
            </div>
            <Btn onClick={sendInvite} dis={sending || !inviteEmail.trim()} sz="sm">
              {sending ? "Sending..." : "Send"}
            </Btn>
          </div>
          <p style={{ fontSize: 11, color: c.td, margin: "4px 0 0" }}>We'll track this referral for you.</p>
        </Card>
      </div>

      {/* Bonus progress */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", margin: 0 }}>
            Bonus Progress — {eligibleCount}/{REFERRAL_BONUS_COUNT} referrals
          </h3>
          {bonusEarned && <span style={{ fontSize: 12, fontWeight: 700, color: c.gn }}>Bonus earned!</span>}
        </div>
        <div style={{ height: 8, background: c.bg, borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${Math.min(100, (eligibleCount / REFERRAL_BONUS_COUNT) * 100)}%`,
            background: bonusEarned ? c.gn : c.ac,
            borderRadius: 4,
            transition: "width 0.3s ease",
          }} />
        </div>
        <p style={{ fontSize: 11, color: c.td, marginTop: 6, marginBottom: 0 }}>
          {bonusEarned
            ? `You've earned an extra ${fmt(REFERRAL_BONUS_AMOUNT)} bonus!`
            : `${REFERRAL_BONUS_COUNT - eligibleCount} more successful referral${REFERRAL_BONUS_COUNT - eligibleCount !== 1 ? "s" : ""} to unlock the ${fmt(REFERRAL_BONUS_AMOUNT)} bonus.`
          }
        </p>
      </Card>

      {/* Referral list */}
      <Card>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
          Your Referrals ({referrals.length})
        </h3>
        {referrals.length === 0 && (
          <div style={{ fontSize: 13, color: c.td, textAlign: "center", padding: "20px 0" }}>
            No referrals yet. Share your link to get started!
          </div>
        )}
        {referrals.map(ref => {
          const statusInfo = REFERRAL_STATUSES[ref.status]
          return (
            <div key={ref.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${c.bdl}`, flexWrap: "wrap" }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: statusInfo?.color || c.td, flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: c.tx, flex: 1, minWidth: 120 }}>
                {ref.referred_email || "Via link"}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                background: `${statusInfo?.color || c.td}15`,
                color: statusInfo?.color || c.td,
                border: `1px solid ${statusInfo?.color || c.td}30`,
              }}>
                {statusInfo?.label || ref.status}
              </span>
              <span style={{ fontSize: 11, color: c.td, minWidth: isMobile ? "100%" : 180, textAlign: isMobile ? "left" : "right", paddingLeft: isMobile ? 18 : 0 }}>
                {getStatusMessage(ref)}
              </span>
            </div>
          )
        })}
      </Card>

      {/* Payouts */}
      {payouts.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
            Payouts
          </h3>
          {payouts.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${c.bdl}` }}>
              <span style={{ fontSize: 13, color: c.tx }}>
                {p.payout_type === "bonus" ? "Bonus reward" : "Referral reward"}
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 600, color: c.tx }}>{fmt(p.amount)}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                  background: p.status === "paid" ? c.gnd : p.status === "approved" ? c.acd : c.sf,
                  color: p.status === "paid" ? c.gn : p.status === "approved" ? c.ac : c.td,
                }}>
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
