import { useEffect } from "react"
import { ShieldLogo } from "./ui"

// Unknown public URLs used to fall through to the landing page. The
// server still answers 200 (the SPA rewrite), so this can't be a real
// 404, but a distinct page marked noindex is what Google needs to stop
// recording every mistyped or stale URL as a duplicate of the home page.
export default function NotFound() {
  useEffect(() => {
    const prev = document.title
    document.title = "Page not found — Hielda"
    const meta = document.createElement("meta")
    meta.name = "robots"
    meta.content = "noindex"
    document.head.appendChild(meta)
    return () => { document.title = prev; meta.remove() }
  }, [])

  return (
    <main style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit", marginBottom: 24 }}>
          <ShieldLogo size={28} />
          <span style={{ fontWeight: 700, fontSize: 18 }}>Hielda</span>
        </a>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>That page doesn't exist</h1>
        <p style={{ color: "#64748b", lineHeight: 1.6, margin: "0 0 24px" }}>
          The link may be out of date. Everything on the site is reachable from the home page.
        </p>
        <a href="/" style={{ display: "inline-block", padding: "10px 18px", borderRadius: 8, background: "#1e5fa0", color: "#fff", fontWeight: 600, textDecoration: "none" }}>
          Back to hielda.com
        </a>
        <p style={{ marginTop: 18, fontSize: 13 }}>
          <a href="/guides" style={{ color: "#1e5fa0" }}>Guides</a>
          {" · "}
          <a href="/calculator" style={{ color: "#1e5fa0" }}>Late payment calculator</a>
        </p>
      </div>
    </main>
  )
}
