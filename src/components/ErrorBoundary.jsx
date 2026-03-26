import { Component } from "react"
import { colors as c, FONT } from "../constants"
import { Btn, ShieldLogo } from "./ui"

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

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          fontFamily: FONT,
          background: c.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          padding: 24,
          textAlign: "center",
        }}>
          <ShieldLogo size={40} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: c.tx, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 13, color: c.tm, maxWidth: 400, lineHeight: 1.6 }}>
            An unexpected error occurred. Please try refreshing the page. If the problem persists, contact support.
          </p>
          <Btn onClick={() => window.location.reload()}>Refresh Page</Btn>
        </div>
      )
    }

    return this.props.children
  }
}
