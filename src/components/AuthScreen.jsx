import { useState } from "react"
import { supabase } from "../supabase"
import { colors as c, FONT } from "../constants"
import { Card, Inp, Btn, ShieldLogo, ErrorBanner, InfoBanner } from "./ui"

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login")
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [name, setName] = useState("")
  const [err, setErr] = useState("")
  const [info, setInfo] = useState("")
  const [loading, setLoading] = useState(false)

  const switchMode = (m) => {
    setMode(m)
    setErr("")
    setInfo("")
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setErr("")
    setInfo("")
    setLoading(true)

    try {
      if (mode === "signup") {
        if (pass.length < 6) {
          setErr("Password must be at least 6 characters.")
          setLoading(false)
          return
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: { data: { full_name: name } },
        })
        if (error) throw error
        if (data.session) {
          onAuth(data.session, data.user)
        } else {
          setInfo("Check your email to confirm your account, then log in.")
          switchMode("login")
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
        if (error) throw error
        onAuth(data.session, data.user)
      }
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }

  const canSubmit = email && pass && (mode === "login" || name)

  return (
    <div style={{ fontFamily: FONT, background: c.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.25, backgroundImage: "radial-gradient(circle,#b0bcc8 0.5px,transparent 0.5px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />
      <Card style={{ width: 400, padding: "40px 36px", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <ShieldLogo size={40} />
          <div style={{ fontSize: 24, fontWeight: 700, color: c.ac, letterSpacing: "-0.02em", marginTop: 12 }}>Hielda</div>
          <div style={{ fontSize: 12, color: c.td, marginTop: 3 }}>Protecting your pay.</div>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && <Inp label="Full Name" value={name} onChange={setName} ph="Your name" />}
          <Inp label="Email" value={email} onChange={setEmail} ph="you@email.com" type="email" />
          <Inp label="Password" value={pass} onChange={setPass} ph={mode === "signup" ? "Choose a password (6+ chars)" : "Your password"} type="password" />

          <ErrorBanner message={err} onDismiss={() => setErr("")} />
          <InfoBanner message={info} />

          <Btn
            type="submit"
            onClick={handleSubmit}
            dis={loading || !canSubmit}
            style={{ width: "100%", justifyContent: "center", marginBottom: 14 }}
          >
            {loading ? "Signing in..." : mode === "signup" ? "Create Account" : "Log In"}
          </Btn>
        </form>

        <div style={{ textAlign: "center", fontSize: 13, color: c.tm }}>
          {mode === "login" ? (
            <span>
              New to Hielda?{" "}
              <button onClick={() => switchMode("signup")} style={{ background: "none", border: "none", color: c.ac, cursor: "pointer", fontFamily: FONT, fontWeight: 600, fontSize: 13 }}>
                Create an account
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: c.ac, cursor: "pointer", fontFamily: FONT, fontWeight: 600, fontSize: 13 }}>
                Log in
              </button>
            </span>
          )}
        </div>
      </Card>
    </div>
  )
}
