import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import { REFERRAL_STATUSES, REFERRAL_THRESHOLD, REFERRAL_REWARD, REFERRAL_BONUS_COUNT, REFERRAL_BONUS_AMOUNT } from "../constants"
import { fmt } from "../utils"
import { Card, Btn, Inp, ErrorBanner } from "./ui"
import { trackEvent } from "../posthog"
import s from './Referrals.module.css'

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return `HIELDA-${code}`
}

export default function Referrals({ profile, userId }) {
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
  const totalEarned = (payouts.filter(p => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0))
  const pendingPayout = payouts.filter(p => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0)

  const getStatusMessage = (ref) => {
    const st = REFERRAL_STATUSES[ref.status]
    if (ref.status === "subscribed") {
      const spent = Number(ref.total_spent) || 0
      const remaining = REFERRAL_THRESHOLD - spent
      if (remaining <= 0) return "Eligible soon"
      const monthsLeft = Math.ceil(remaining / 3.99)
      return `${fmt(spent)}/${fmt(REFERRAL_THRESHOLD)} spent — ~${monthsLeft} month${monthsLeft !== 1 ? "s" : ""} to go`
    }
    return st?.desc || ""
  }

  if (loading) {
    return <div className={s.loading}>Loading referrals...</div>
  }

  return (
    <div>
      <div className={s.header}>
        <h1 className={s.title}>Refer & Earn</h1>
        <p className={s.subtitle}>
          Earn {fmt(REFERRAL_REWARD)} for every friend who subscribes and spends {fmt(REFERRAL_THRESHOLD)} with Hielda. Get {REFERRAL_BONUS_COUNT} referrals and earn an extra {fmt(REFERRAL_BONUS_AMOUNT)} bonus.
        </p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {/* Stats */}
      <div className={s.statsGrid}>
        {[
          { label: "Referrals", value: referrals.length, mono: false },
          { label: "Eligible", value: eligibleCount, mono: false },
          { label: "Earned", value: fmt(totalEarned), mono: true },
          { label: "Pending", value: fmt(pendingPayout), mono: true },
        ].map(stat => (
          <div key={stat.label} className={s.statCard}>
            <div className={s.statLabel}>{stat.label}</div>
            <div className={stat.mono ? s.statValueMono : s.statValue}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className={s.twoColGrid}>
        {/* Share link */}
        <Card>
          <h3 className={s.sectionLabel}>Your Referral Link</h3>
          <div className={s.linkRow}>
            <input readOnly value={referralLink} className={s.linkInput} />
            <Btn onClick={copyLink} sz="sm">{copied ? "Copied!" : "Copy"}</Btn>
          </div>
          <p className={s.hint}>Share this link with anyone. When they sign up and spend {fmt(REFERRAL_THRESHOLD)}, you earn {fmt(REFERRAL_REWARD)}.</p>
        </Card>

        {/* Invite by email */}
        <Card>
          <h3 className={s.sectionLabel}>Invite by Email</h3>
          <div className={s.inviteRow}>
            <div className={s.inviteInputWrap}>
              <Inp label="" value={inviteEmail} onChange={setInviteEmail} ph="friend@email.com" type="email" />
            </div>
            <Btn onClick={sendInvite} dis={sending || !inviteEmail.trim()} sz="sm">
              {sending ? "Sending..." : "Send"}
            </Btn>
          </div>
          <p className={s.hintTop}>We'll track this referral for you.</p>
        </Card>
      </div>

      {/* Bonus progress */}
      <Card style={{ marginBottom: 20 }}>
        <div className={s.bonusHeader}>
          <h3 className={s.bonusLabel}>
            Bonus Progress — {eligibleCount}/{REFERRAL_BONUS_COUNT} referrals
          </h3>
          {bonusEarned && <span className={s.bonusEarned}>Bonus earned!</span>}
        </div>
        <div className={s.progressTrack}>
          <div
            className={s.progressBar}
            style={{
              width: `${Math.min(100, (eligibleCount / REFERRAL_BONUS_COUNT) * 100)}%`,
              background: bonusEarned ? "var(--gn)" : "var(--ac)",
            }}
          />
        </div>
        <p className={s.bonusHint}>
          {bonusEarned
            ? `You've earned an extra ${fmt(REFERRAL_BONUS_AMOUNT)} bonus!`
            : `${REFERRAL_BONUS_COUNT - eligibleCount} more successful referral${REFERRAL_BONUS_COUNT - eligibleCount !== 1 ? "s" : ""} to unlock the ${fmt(REFERRAL_BONUS_AMOUNT)} bonus.`
          }
        </p>
      </Card>

      {/* Referral list */}
      <Card>
        <h3 className={s.listTitle}>
          Your Referrals ({referrals.length})
        </h3>
        {referrals.length === 0 && (
          <div className={s.emptyState}>
            No referrals yet. Share your link to get started!
          </div>
        )}
        {referrals.map(ref => {
          const statusInfo = REFERRAL_STATUSES[ref.status]
          return (
            <div key={ref.id} className={s.referralRow}>
              <div className={s.statusDot} style={{ background: statusInfo?.color || "var(--td)" }} />
              <span className={s.referralEmail}>
                {ref.referred_email || "Via link"}
              </span>
              <span
                className={s.statusBadge}
                style={{
                  background: `${statusInfo?.color || "var(--td)"}15`,
                  color: statusInfo?.color || "var(--td)",
                  border: `1px solid ${statusInfo?.color || "var(--td)"}30`,
                }}
              >
                {statusInfo?.label || ref.status}
              </span>
              <span className={s.statusMessage}>
                {getStatusMessage(ref)}
              </span>
            </div>
          )
        })}
      </Card>

      {/* Payouts */}
      {payouts.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <h3 className={s.listTitle}>Payouts</h3>
          {payouts.map(p => (
            <div key={p.id} className={s.payoutRow}>
              <span className={s.payoutType}>
                {p.payout_type === "bonus" ? "Bonus reward" : "Referral reward"}
              </span>
              <div className={s.payoutRight}>
                <span className={s.payoutAmount}>{fmt(p.amount)}</span>
                <span
                  className={s.payoutBadge}
                  style={{
                    background: p.status === "paid" ? "var(--gnd)" : p.status === "approved" ? "var(--acd)" : "var(--sf)",
                    color: p.status === "paid" ? "var(--gn)" : p.status === "approved" ? "var(--ac)" : "var(--td)",
                  }}
                >
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
