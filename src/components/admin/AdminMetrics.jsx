import { useState, useEffect } from "react"
import { supabase } from "../../supabase"
import { Card, Spinner } from "../ui"
import s from './AdminMetrics.module.css'

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
    <div className={s.statBar}>
      <div className={s.statBarHeader}>
        <span className={s.statBarLabel} title={label}>{label}</span>
        <div className={s.statBarRight}>
          {signups > 0 && (
            <span className={s.statBarSignups}>{signups} signup{signups !== 1 ? "s" : ""}</span>
          )}
          <span className={s.statBarValue}>{value}</span>
        </div>
      </div>
      <div className={s.statBarTrack}>
        <div className={s.statBarFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SetupCard() {
  return (
    <Card style={{ padding: "28px 24px" }}>
      <h3 className={s.setupTitle}>Connect PostHog for traffic analytics</h3>
      <p className={s.setupDesc}>
        To see where your visitors come from, you need to add a PostHog Personal API Key to Vercel.
      </p>
      <ol className={s.setupSteps}>
        <li>Go to <strong>PostHog → Settings → Personal API Keys</strong> → Create new key</li>
        <li>Copy your <strong>Project ID</strong> from PostHog → Project Settings</li>
        <li>Add to Vercel env vars:
          <div className={s.setupCode}>
            POSTHOG_PERSONAL_API_KEY = phx_xxxxxxx<br />
            POSTHOG_PROJECT_ID = 12345
          </div>
        </li>
        <li>Redeploy Vercel</li>
      </ol>
      <p className={s.setupHint}>
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

  if (loading) return <div className={s.loading}><Spinner size={20} /></div>

  if (error) {
    return (
      <Card style={{ textAlign: "center", padding: 32 }}>
        <p className={s.errorText}>{error}</p>
      </Card>
    )
  }

  if (!data?.configured) return <SetupCard />

  const maxVisits = Math.max(...(data.top_sources?.map(src => src.visits) || [1]))
  const maxEvents = Math.max(...(data.events?.map(e => e.count) || [1]))
  const hasUtm = (data.utm_sources?.length || 0) > 0 || (data.utm_campaigns?.length || 0) > 0

  return (
    <div>
      <div className={s.twoColGrid}>
        {/* Traffic Sources */}
        <Card>
          <h3 className={s.sectionLabel}>
            Traffic Sources — last 30 days
          </h3>
          {(data.top_sources?.length || 0) === 0 ? (
            <p className={s.noData}>No data yet.</p>
          ) : (
            data.top_sources.map(src => (
              <StatBar key={src.source} label={src.source} value={src.visits} max={maxVisits} signups={src.signups} />
            ))
          )}
          <p className={s.sourceHint}>
            "(direct / none)" = typed URL or no referrer captured
          </p>
        </Card>

        {/* Key Events */}
        <Card>
          <h3 className={s.sectionLabel}>
            Activity — last 30 days
          </h3>
          {(data.events?.length || 0) === 0 ? (
            <p className={s.noData}>No events yet.</p>
          ) : (
            data.events.map(e => (
              <StatBar key={e.event} label={EVENT_LABELS[e.event] || e.event} value={e.count} max={maxEvents} />
            ))
          )}
        </Card>
      </div>

      {/* UTM / Campaign breakdown */}
      {hasUtm && (
        <div className={s.threeColGrid}>
          {data.utm_sources?.length > 0 && (
            <Card>
              <h3 className={s.sectionLabelSm}>UTM Source</h3>
              {data.utm_sources.map(src => (
                <div key={src.label} className={s.utmRow}>
                  <span className={s.utmLabel}>{src.label}</span>
                  <span className={s.utmValue}>{src.visits}</span>
                </div>
              ))}
            </Card>
          )}
          {data.utm_mediums?.length > 0 && (
            <Card>
              <h3 className={s.sectionLabelSm}>UTM Medium</h3>
              {data.utm_mediums.map(src => (
                <div key={src.label} className={s.utmRow}>
                  <span className={s.utmLabel}>{src.label}</span>
                  <span className={s.utmValue}>{src.visits}</span>
                </div>
              ))}
            </Card>
          )}
          {data.utm_campaigns?.length > 0 && (
            <Card>
              <h3 className={s.sectionLabelSm}>Campaign</h3>
              {data.utm_campaigns.map(src => (
                <div key={src.label} className={s.utmRow}>
                  <span className={s.utmLabel}>{src.label}</span>
                  <span className={s.utmValue}>{src.visits}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Daily visitors chart */}
      {data.daily_visitors?.length > 0 && (
        <Card>
          <h3 className={s.dailyLabel}>
            Daily Visitors — last 14 days
          </h3>
          <div className={s.dailyGrid} style={{ gridTemplateColumns: `repeat(${Math.min(data.daily_visitors.length, 7)}, 1fr)` }}>
            {data.daily_visitors.slice(-14).map(d => {
              const maxV = Math.max(...data.daily_visitors.map(x => x.visitors), 1)
              const barH = Math.max(4, Math.round((d.visitors / maxV) * 60))
              const date = new Date(d.day)
              const label = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
              return (
                <div key={d.day} className={s.dailyCell}>
                  <div className={s.dailyBarWrap}>
                    <div
                      className={s.dailyBar}
                      style={{
                        height: barH,
                        background: d.signups > 0 ? "var(--gn)" : "var(--ac)",
                      }}
                      title={`${d.visitors} visitors, ${d.signups} signups`}
                    />
                  </div>
                  <div className={s.dailyDate}>{label}</div>
                  <div className={s.dailyCount}>{d.visitors}</div>
                </div>
              )
            })}
          </div>
          <p className={s.dailyHint}>
            Green bars = days with signups. Hover for detail.
          </p>
        </Card>
      )}

      {/* PostHog direct links */}
      <Card style={{ marginTop: 16 }}>
        <h3 className={s.deepDiveLabel}>Deep Dive in PostHog</h3>
        <div className={s.deepDiveGrid}>
          {[
            { label: "Session Recordings", url: "https://eu.posthog.com/replay", desc: "Watch real user sessions" },
            { label: "Funnels", url: "https://eu.posthog.com/insights", desc: "Landing → Sign-up conversion" },
            { label: "User Paths", url: "https://eu.posthog.com/insights", desc: "Where users go after landing" },
          ].map(link => (
            <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className={s.deepDiveLink}>
              <div className={s.deepDiveName}>{link.label}</div>
              <div className={s.deepDiveDesc}>{link.desc}</div>
            </a>
          ))}
        </div>
      </Card>
    </div>
  )
}
