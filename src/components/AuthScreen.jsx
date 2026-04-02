import { useState } from "react"
import { supabase } from "../supabase"
import { Card, Inp, Btn, ShieldLogo, ErrorBanner, InfoBanner } from "./ui"
import { trackEvent } from "../posthog"
import s from "./AuthScreen.module.css"

export default function AuthScreen({ onAuth, onBack }) {
  const [mode, setMode] = useState("login")
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [name, setName] = useState("")
  const [err, setErr] = useState("")
  const [info, setInfo] = useState("")
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const linkReferral = async (newUserId) => {
    try {
      const storedCode = localStorage.getItem("hielda_referral_code")
      if (!storedCode || !newUserId) return
      const { data: refs } = await supabase
        .from("referrals")
        .select("id")
        .eq("referral_code", storedCode)
        .is("referred_user_id", null)
        .limit(1)
      if (refs?.length) {
        await supabase.from("referrals").update({ referred_user_id: newUserId, status: "signed_up" }).eq("id", refs[0].id)
      } else {
        const { data: referrer } = await supabase
          .from("profiles")
          .select("id")
          .eq("referral_code", storedCode)
          .single()
        if (referrer) {
          await supabase.from("referrals").insert({
            referrer_id: referrer.id,
            referral_code: storedCode,
            referred_email: email,
            referred_user_id: newUserId,
            status: "signed_up",
          })
        }
      }
      localStorage.removeItem("hielda_referral_code")
      trackEvent("referral_signed_up", { code: storedCode })
    } catch {
      // Silently fail — referral tracking is non-critical
    }
  }

  const switchMode = (m) => {
    setMode(m)
    setErr("")
    setInfo("")
    setResetSent(false)
  }

  const handleReset = async (e) => {
    e?.preventDefault()
    if (!email.trim()) { setErr("Enter your email address first."); return }
    setLoading(true)
    setErr("")
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    })
    setLoading(false)
    if (error) { setErr(error.message); return }
    setResetSent(true)
    setInfo("Password reset email sent — check your inbox.")
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setErr("")
    setInfo("")
    setLoading(true)

    try {
      if (mode === "signup") {
        trackEvent("sign_up_started")
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
          const utms = (() => { try { return JSON.parse(localStorage.getItem("hielda_utm") || "{}") } catch { return {} } })()
          trackEvent("sign_up_completed", utms)
          await linkReferral(data.user?.id)
          onAuth(data.session, data.user)
        } else {
          const utms = (() => { try { return JSON.parse(localStorage.getItem("hielda_utm") || "{}") } catch { return {} } })()
          trackEvent("sign_up_completed", utms)
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
    <div className={s.wrapper}>
      <div className={s.patternOverlay} />
      <Card style={{ width: "100%", maxWidth: 400, padding: 0, position: "relative", zIndex: 1, margin: "0 16px" }}>
        <div className={s.cardInner}>
          {onBack && (
            <button onClick={onBack} className={s.backBtn}>
              ← Back
            </button>
          )}
          <div className={s.header}>
            <ShieldLogo size={40} />
            <div className={s.title}>Hielda</div>
            <div className={s.subtitle}>Protecting your pay.</div>
          </div>

          {mode === "reset" ? (
            <form onSubmit={handleReset}>
              <p className={s.resetText}>
                Enter your email and we'll send you a link to reset your password.
              </p>
              <Inp label="Email" value={email} onChange={setEmail} ph="you@email.com" type="email" />
              <ErrorBanner message={err} onDismiss={() => setErr("")} />
              <InfoBanner message={info} />
              <Btn type="submit" dis={loading || !email.trim() || resetSent} style={{ width: "100%", justifyContent: "center", marginBottom: 14 }}>
                {loading ? "Sending..." : resetSent ? "Email sent!" : "Send reset link"}
              </Btn>
              <div className={s.centeredText}>
                <button onClick={() => switchMode("login")} className={s.backToLogin}>
                  ← Back to log in
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              {mode === "signup" && <Inp label="Full Name" value={name} onChange={setName} ph="Your name" />}
              <Inp label="Email" value={email} onChange={setEmail} ph="you@email.com" type="email" />
              <Inp label="Password" value={pass} onChange={setPass} ph={mode === "signup" ? "Choose a password (6+ chars)" : "Your password"} type="password" />

              {mode === "login" && (
                <div className={s.forgotWrap}>
                  <button
                    type="button"
                    onClick={() => switchMode("reset")}
                    className={s.forgotBtn}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <ErrorBanner message={err} onDismiss={() => setErr("")} />
              <InfoBanner message={info} />

              <Btn
                type="submit"
                dis={loading || !canSubmit}
                style={{ width: "100%", justifyContent: "center", marginBottom: 14 }}
              >
                {loading ? "Signing in..." : mode === "signup" ? "Create Account" : "Log In"}
              </Btn>
            </form>
          )}

          {mode !== "reset" && (
            <div className={s.modeToggle}>
              {mode === "login" ? (
                <span>
                  New to Hielda?{" "}
                  <button onClick={() => switchMode("signup")} className={s.modeBtn}>
                    Create an account
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{" "}
                  <button onClick={() => switchMode("login")} className={s.modeBtn}>
                    Log in
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
