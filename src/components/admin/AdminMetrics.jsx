import { useState, useEffect } from "react"
import { supabase } from "../../supabase"
import { colors as c, FONT, MONO } from "../../constants"
import { Card, Spinner } from "../ui"

const EVENT_LABELS = {
  sign_up_started: "Sign-up started",
  sign_up_completed: "Sign-up completed",
  login: "Logins",
  invoice_created: "Invoices created",
  invoice_paid: "Invoices marked paid",
  chase_sent: "Chase emails sent",
  pdf_downloaded: "PDFs downloaded",
  calculator_used: "Calculator used",
  referral_link_copied: "Referral links copied",
  referral_invite_sent: "Referral invites sent",
}

function StatBar({ label, value, max, signups }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: c.tx, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }} title={label}>
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {signups > 0 && (
            <span style={{ fontSize: 10, color: c.gn, fontWeight: 600 }}>{signups} signup{signups !== 1 ? "s" : ""}</span>
          )}
          <span style={{ fontSize: 12, fontFamily: MONO, fontWeight: 600, color: c.tx, width: 36, textAlign: "right" }}>{value}</span>
        </div>
      </div>
      <div style={{ height: 4, background: c.bd, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: c.ac, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function SetupCard() {
  return (
    <Card style={{ padding: "28px 24px" }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: c.tx, margin: "0 0 8px" }}>Connect PostHog for traffic analytics</h3>
      <p style={{ fontSize: 13, color: c.tm, margin: "0 0 16px", lineHeight: 1.6 }}>
        To see where your visitors come from, you need to add a PostHog Personal API Key to Vercel.
      </p>
      <ol style={{ fontSize: 13, color: c.tm, lineHeight: 2, margin: "0 0 16px", paddingLeft: 20 }}>
        <li>Go to <strong>PostHog → Settings → Personal API Keys</strong> → Create new key</li>
        <li>Copy your <strong>Project ID</strong> from PostHog → Project Settings</li>
        <li>Add to Vercel env vars:
          <div style={{ marginTop: 6, padding: "8px 12px", background: c.bg, borderRadius: 6, fontFamily: MONO, fontSize: 11, color: c.tx, lineHeight: 1.8 }}>
            POSTHOG_PERSONAL_API_KEY = phx_xxxxxxx<br />
            POSTHOG_PROJECT_ID = 12345
          </div>
        </li>
        <li>Redeploy Vercel</li>
      </ol>
      <p style={{ fontSize: 11, color: c.td, margin: 0 }}>
        PostHog automatically captures referrer, UTM params, and all page views — no extra code needed.
      </p>
    </Card>
  )
}

export default function AdminMetrics({ isMobile }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/admin-metrics", {
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
      <Card style={{ textAlign: "center", padding: 32 }}>
        <p style={{ color: c.or, fontSize: 13 }}>{error}</p>
      </Card>
    )
  }

  if (!data?.configured) return <SetupCard />

  const maxVisits = Math.max(...(data.top_sources?.map(s => s.visits) || [1]))
  const maxEvents = Math.max(...(data.events?.map(e => e.count) || [1]))
  const hasUtm = (data.utm_sources?.length || 0) > 0 || (data.utm_campaigns?.length || 0) > 0

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Traffic Sources */}
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 16px" }}>
            Traffic Sources — last 30 days
          </h3>
          {(data.top_sources?.length || 0) === 0 ? (
            <p style={{ fontSize: 12, color: c.td }}>No data yet.</p>
          ) : (
            data.top_sources.map(s => (
              <StatBar key={s.source} label={s.source} value={s.visits} max={maxVisits} signups={s.signups} />
            ))
          )}
          <p style={{ fontSize: 10, color: c.td, marginTop: 8, marginBottom: 0 }}>
            "(direct / none)" = typed URL or no referrer captured
          </p>
        </Card>

        {/* Key Events */}
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 16px" }}>
            Activity — last 30 days
          </h3>
          {(data.events?.length || 0) === 0 ? (
            <p style={{ fontSize: 12, color: c.td }}>No events yet.</p>
          ) : (
            data.events.map(e => (
              <StatBar key={e.event} label={EVENT_LABELS[e.event] || e.event} value={e.count} max={maxEvents} />
            ))
          )}
        </Card>
      </div>

      {/* UTM / Campaign breakdown */}
      {hasUtm && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          {data.utm_sources?.length > 0 && (
            <Card>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>UTM Source</h3>
              {data.utm_sources.map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${c.bdl}`, fontSize: 12 }}>
                  <span style={{ color: c.tx }}>{s.label}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 600, color: c.tx }}>{s.visits}</span>
                </div>
              ))}
            </Card>
          )}
          {data.utm_mediums?.length > 0 && (
            <Card>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>UTM Medium</h3>
              {data.utm_mediums.map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${c.bdl}`, fontSize: 12 }}>
                  <span style={{ color: c.tx }}>{s.label}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 600, color: c.tx }}>{s.visits}</span>
                </div>
              ))}
            </Card>
          )}
          {data.utm_campaigns?.length > 0 && (
            <Card>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Campaign</h3>
              {data.utm_campaigns.map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${c.bdl}`, fontSize: 12 }}>
                  <span style={{ color: c.tx }}>{s.label}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 600, color: c.tx }}>{s.visits}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Daily visitors chart (simple text table) */}
      {data.daily_visitors?.length > 0 && (
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
            Daily Visitors — last 14 days
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.daily_visitors.length, 7)}, 1fr)`, gap: 6 }}>
            {data.daily_visitors.slice(-14).map(d => {
              const maxV = Math.max(...data.daily_visitors.map(x => x.visitors), 1)
              const barH = Math.max(4, Math.round((d.visitors / maxV) * 60))
              const date = new Date(d.day)
              const label = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
              return (
                <div key={d.day} style={{ textAlign: "center" }}>
                  <div style={{ height: 64, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 4 }}>
                    <div style={{ width: "70%", height: barH, background: d.signups > 0 ? c.gn : c.ac, borderRadius: "2px 2px 0 0", opacity: 0.8 }} title={`${d.visitors} visitors, ${d.signups} signups`} />
                  </div>
                  <div style={{ fontSize: 9, color: c.td }}>{label}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: c.tx }}>{d.visitors}</div>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 10, color: c.td, margin: "8px 0 0" }}>
            Green bars = days with signups. Hover for detail.
          </p>
        </Card>
      )}

      {/* PostHog direct links */}
      <Card style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Deep Dive in PostHog</h3>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Session Recordings", url: "https://eu.posthog.com/replay", desc: "Watch real user sessions" },
            { label: "Funnels", url: "https://eu.posthog.com/insights", desc: "Landing → Sign-up conversion" },
            { label: "User Paths", url: "https://eu.posthog.com/insights", desc: "Where users go after landing" },
          ].map(link => (
            <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" style={{
              display: "block", padding: "10px 14px", background: c.bg, borderRadius: 8,
              border: `1px solid ${c.bd}`, textDecoration: "none",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.ac }}>{link.label}</div>
              <div style={{ fontSize: 11, color: c.tm, marginTop: 2 }}>{link.desc}</div>
            </a>
          ))}
        </div>
      </Card>
    </div>
  )
}
