import { colors as c, FONT } from "../../constants"
import { Card } from "../ui"

export default function AdminMetrics({ isMobile }) {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY

  if (!posthogKey) {
    return (
      <Card style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.tx, marginBottom: 6 }}>PostHog Not Configured</div>
        <p style={{ color: c.tm, fontSize: 13, margin: 0 }}>
          Add your VITE_POSTHOG_KEY to .env to enable analytics. Then create a shared dashboard in PostHog and embed it here.
        </p>
      </Card>
    )
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Quick Links</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "PostHog Dashboard", url: "https://eu.posthog.com", desc: "Full analytics, funnels, session recordings" },
              { label: "Session Recordings", url: "https://eu.posthog.com/replay", desc: "Watch how users navigate the site" },
              { label: "Funnels", url: "https://eu.posthog.com/insights", desc: "Sign-up conversion, feature adoption" },
            ].map(link => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", padding: "10px 14px", background: c.bg, borderRadius: 8,
                  border: `1px solid ${c.bd}`, textDecoration: "none", color: c.tx,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: c.ac }}>{link.label}</div>
                <div style={{ fontSize: 11, color: c.tm, marginTop: 2 }}>{link.desc}</div>
              </a>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Key Events Tracked</h3>
          <div style={{ fontSize: 12, color: c.tm, lineHeight: 1.8 }}>
            {[
              "sign_up_started / sign_up_completed",
              "login",
              "invoice_created",
              "invoice_paid",
              "chase_sent",
              "pdf_downloaded",
              "calculator_used",
              "referral_link_copied / referral_invite_sent",
            ].map(evt => (
              <div key={evt} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: c.ac, flexShrink: 0 }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{evt}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>
          Embedded Dashboard
        </h3>
        <p style={{ fontSize: 12, color: c.td, marginBottom: 12 }}>
          Create a shared dashboard in PostHog and paste the embed URL below. You can do this from PostHog &gt; Dashboards &gt; Share &gt; Embed.
        </p>
        <div style={{
          height: 400, background: c.bg, borderRadius: 8, border: `1px dashed ${c.bd}`,
          display: "flex", alignItems: "center", justifyContent: "center", color: c.td, fontSize: 13,
        }}>
          PostHog dashboard embed goes here
        </div>
      </Card>
    </div>
  )
}
