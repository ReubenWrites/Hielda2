import { useState, useEffect } from "react"
import { Lock, Mail } from "lucide-react"
import { supabase } from "../supabase"
import { Card, Inp, Btn, ShieldLogo, ErrorBanner, InfoBanner } from "./ui"
import { trackEvent } from "../posthog"
import s from "./AuthScreen.module.css"

export default function AuthScreen({ onAuth, onBack }) {
  // Every "Start Free Trial" button lands here. It used to open the LOGIN
  // form regardless, leaving a new visitor to find the small "Create an
  // account" link. The CTAs pass ?mode=signup; "Log In" comes bare.
  // Read from window rather than the router: this screen is also rendered
  // outside a <Router> in tests.
  const [mode, setMode] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login" } catch { return "login" }
  })
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [name, setName] = useState("")
  const [err, setErr] = useState("")
  const [info, setInfo] = useState("")
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState(false)

  // Google sign-in is shown only once the provider is switched on in
  // Supabase (Auth -> Providers). The public settings endpoint says which
  // providers are live, so the button appears by itself when it is, and a
  // visitor never sees a button that errors.
  const [googleEnabled, setGoogleEnabled] = useState(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const base = import.meta.env.VITE_SUPABASE_URL
        const key = import.meta.env.VITE_SUPABASE_KEY
        if (!base || !key) return
        const r = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: key } })
        const j = await r.json()
        if (!cancelled && j?.external?.google) setGoogleEnabled(true)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  const signInWithGoogle = async () => {
    setErr("")
    setLoading(true)
    trackEvent(mode === "signup" ? "sign_up_started" : "login_started", { method: "google" })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) { setErr(error.message); setLoading(false) }
    // On success the browser leaves for Google; the session arrives via
    // onAuthStateChange in App.jsx when it comes back.
  }

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
          setConfirmEmail(true)
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

          {confirmEmail ? (
            <div className={s.confirmScreen}>
              <div className={s.confirmIcon}>&#9993;</div>
              <h2 className={s.confirmTitle}>Check your inbox</h2>
              <p className={s.confirmText}>
                We've sent a confirmation link to <strong>{email}</strong>. Click the link in the email to activate your account.
              </p>
              <p className={s.confirmHint}>
                Can't find it? Check your spam or junk folder.
              </p>
              <button
                onClick={() => { setConfirmEmail(false); switchMode("login") }}
                className={s.confirmBtn}
              >
                Go to log in
              </button>
            </div>
          ) : mode === "reset" ? (
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
              {googleEnabled && (
                <>
                  <button type="button" onClick={signInWithGoogle} disabled={loading} className={s.googleBtn}>
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                    {mode === "signup" ? "Sign up with Google" : "Log in with Google"}
                  </button>
                  <div className={s.orRow}><span>or</span></div>
                </>
              )}
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

          {mode !== "reset" && !confirmEmail && (
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

      {/* Trust signals: reassurance for first-time users about what
          Hielda does and doesn't do with their data. Especially important
          on the auth screen for users hesitant to hand over an email
          before they've used the product. */}
      <div className={s.trustRow} aria-label="Trust signals">
        <div className={s.trustItem}>
          <span className={s.trustIcon} aria-hidden="true"><Lock size={14} /></span>
          <span>Encrypted in transit and at rest</span>
        </div>
        <div className={s.trustItem}>
          <span className={s.trustIcon} aria-hidden="true"><Mail size={14} /></span>
          <span>We never email your clients without your approval</span>
        </div>
        <div className={s.trustItem}>
          <span className={s.trustIcon} aria-hidden="true">🇬🇧</span>
          <span>Built for UK freelancers — Late Payment Act 1998</span>
        </div>
      </div>
    </div>
  )
}
