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

  render() {
    if (this.state.hasError) {
      return (
        <div className={s.container}>
          <ShieldLogo size={40} />
          <h1 className={s.title}>Something went wrong</h1>
          <p className={s.message}>
            An unexpected error occurred. Please try refreshing the page. If the problem persists, contact support.
          </p>
          <Btn onClick={() => window.location.reload()}>Refresh Page</Btn>
        </div>
      )
    }

    return this.props.children
  }
}
