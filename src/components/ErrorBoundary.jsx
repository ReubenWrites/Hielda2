import { Component } from "react"
import { Btn, ShieldLogo } from "./ui"
import s from './ErrorBoundary.module.css'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error("Hielda error:", error, info.componentStack)
  }

  // Saved state (drafts, flags, a half-finished prefill) lives in local and
  // session storage under hielda_ / hielda: keys. If a bad value is what's
  // crashing the app, "Refresh" just crashes again; this clears it. The
  // login session is Supabase's own key and is left alone.
  resetAndReload = () => {
    try {
      for (const store of [localStorage, sessionStorage]) {
        Object.keys(store).filter((k) => /^hielda[_:]/.test(k)).forEach((k) => store.removeItem(k))
      }
    } catch {}
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error
      const details = `${err?.name || "Error"}: ${err?.message || String(err)}\n${(err?.stack || "").split("\n").slice(0, 6).join("\n")}`
      return (
        <div className={s.container}>
          <ShieldLogo size={40} />
          <h1 className={s.title}>Something went wrong</h1>
          <p className={s.message}>
            An unexpected error occurred. Please try refreshing the page. If the problem persists, contact support.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Btn onClick={() => window.location.reload()}>Refresh Page</Btn>
            <Btn v="ghost" onClick={this.resetAndReload}>Clear saved data &amp; reload</Btn>
          </div>
          {/* The message itself, so support (and the person reporting it)
              can see what actually broke instead of guessing. */}
          <details style={{ marginTop: 20, maxWidth: 560, textAlign: "left" }}>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "#64748b" }}>Technical details</summary>
            <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f1f3f6", padding: 12, borderRadius: 8, marginTop: 8 }}>{details}</pre>
            <Btn sz="sm" v="ghost" onClick={() => { try { navigator.clipboard.writeText(details) } catch {} }}>Copy details</Btn>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
