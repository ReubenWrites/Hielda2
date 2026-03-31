import { useState, useEffect, useCallback } from "react"
import { supabase } from "./supabase"
import { colors as c, FONT, MONO, loadLiveBoeRate } from "./constants"
import { fmt, todayStr } from "./utils"
import { identifyUser, resetUser, trackPageView, trackEvent } from "./posthog"
import { ShieldLogo, Spinner } from "./components/ui"
import AuthScreen from "./components/AuthScreen"
import Onboarding from "./components/Onboarding"
import Dashboard from "./components/Dashboard"
import Detail from "./components/Detail"
import Create from "./components/Create"
import Settings from "./components/Settings"
import HowItWorks from "./components/HowItWorks"
import Billing from "./components/Billing"
import SubscriptionGate from "./components/SubscriptionGate"
import LandingPage from "./components/LandingPage"
import Calculator from "./components/Calculator"
import PrivacyPolicy from "./components/PrivacyPolicy"
import AdminDashboard from "./components/AdminDashboard"
import Referrals from "./components/Referrals"
import OnboardingTour, { shouldShowTour } from "./components/OnboardingTour"

const NAV_ITEMS = [
  { id: "dash", l: "Dashboard", i: "◉" },
  { id: "create", l: "New Invoice", i: "+" },
  { id: "referrals", l: "Refer & Earn", i: "🎁" },
  { id: "how", l: "How It Works", i: "?" },
  { id: "settings", l: "Your Details", i: "⚙" },
  { id: "billing", l: "Your Account", i: "○" },
]

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])
  return matches
}

export default function App() {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [invs, setInvs] = useState([])
  const [view, setView] = useState("dash")
  const [selId, setSelId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    const handler = () => setShowPrivacy(true)
    window.addEventListener("hielda:show-privacy", handler)
    return () => window.removeEventListener("hielda:show-privacy", handler)
  }, [])

  const isMobile = useMediaQuery("(max-width: 768px)")
  const isAdmin = (profile?.email || user?.email) === import.meta.env.VITE_ADMIN_EMAIL

  // Load live BoE rate on mount
  useEffect(() => { loadLiveBoeRate() }, [])

  // Detect referral code in URL (/ref/{code}) and store it
  useEffect(() => {
    const path = window.location.pathname
    const match = path.match(/^\/ref\/([A-Za-z0-9-]+)$/)
    if (match) {
      localStorage.setItem("hielda_referral_code", match[1])
      window.history.replaceState(null, "", "/")
      trackEvent("referral_link_visited", { code: match[1] })
    }
  }, [])

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        setUser(session.user)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadData = useCallback(async () => {
    if (!user) return
    setDataError("")
    try {
      const [{ data: profs, error: profErr }, { data: invoices, error: invErr }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id),
        supabase.from("invoices").select("id,ref,description,status,due_date,issue_date,amount,amount_paid,subtotal,vat_amount,total_with_vat,client_name,client_email,client_address,chase_stage,created_at,auto_chase,no_fines,payment_term_days,send_method,line_items,client_ref,cc_emails,bcc_emails,paid_date").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
      ])

      if (profErr) throw profErr
      if (invErr) throw invErr

      if (profs?.[0]) {
        setProfile(profs[0])
        identifyUser(profs[0])
      }

      const today = todayStr()
      setInvs(
        (invoices || []).map((i) => {
          if (i.status === "pending" && i.due_date < today) {
            return { ...i, status: "overdue", chase_stage: i.chase_stage || "reminder_1" }
          }
          return i
        })
      )

      // Load subscription (don't fail if table doesn't exist yet)
      try {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .single()
        if (subData) setSubscription(subData)
      } catch {
        // subscriptions table may not exist yet
      }
    } catch (e) {
      setDataError("Failed to load data. Please try refreshing.")
      console.error("Data load error:", e)
    }
    setLoading(false)
    if (user && shouldShowTour(user.id)) setShowTour(true)
  }, [user])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  const handleAuth = (sess, usr) => {
    setSession(sess)
    setUser(usr)
    trackEvent("login")
  }

  const nav = (v, id) => {
    setView(v)
    setSelId(id || null)
    if (isMobile) setSidebarOpen(false)
    trackPageView(v)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    resetUser()
    setSession(null)
    setUser(null)
    setProfile(null)
    setSubscription(null)
    setInvs([])
    setView("dash")
  }

  const sel = invs.find((i) => i.id === selId)

  // Pre-compute header stats once
  const overdueInvs = invs.filter((i) => i.status === "overdue")
  const pendingInvs = invs.filter((i) => i.status === "pending")

  if (loading) {
    return (
      <div style={{ fontFamily: FONT, background: c.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <Spinner size={28} />
        <span style={{ color: c.tm, fontSize: 13 }}>Loading your invoices...</span>
      </div>
    )
  }

  if (!session) {
    if (showPrivacy) return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />
    if (showCalculator) return <Calculator onBack={() => setShowCalculator(false)} onGetStarted={() => { setShowCalculator(false); setShowAuth(true) }} isMobile={isMobile} />
    if (showAuth) return <AuthScreen onAuth={handleAuth} onBack={() => setShowAuth(false)} />
    return <LandingPage onGetStarted={() => { trackPageView("auth"); setShowAuth(true) }} onPrivacy={() => { trackPageView("privacy"); setShowPrivacy(true) }} onCalculator={() => { trackPageView("calculator"); setShowCalculator(true) }} isMobile={isMobile} />
  }

  // Show onboarding for new users who haven't completed setup
  if (!profile || !profile.onboarding_complete) {
    return (
      <Onboarding
        user={user}
        profile={profile}
        onComplete={() => { loadData(); setView("dash") }}
      />
    )
  }

  if (showPrivacy) return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />

  return (
    <div style={{ fontFamily: FONT, background: c.bg, color: c.tx, minHeight: "100vh", display: "flex" }}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          width: 210,
          flexShrink: 0,
          background: c.ac,
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
          position: isMobile ? "fixed" : "relative",
          overflow: "hidden",
          height: isMobile ? "100vh" : "auto",
          zIndex: isMobile ? 100 : "auto",
          transform: isMobile && !sidebarOpen ? "translateX(-100%)" : "translateX(0)",
          transition: "transform 0.25s ease",
        }}
      >
        <div style={{ padding: "0 8px", marginBottom: 10, position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 9 }}>
          <ShieldLogo size={36} white />
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>Hielda</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2, letterSpacing: "0.02em" }}>Protecting your pay.</div>
          </div>
        </div>

        <nav style={{ flex: 1, position: "relative", zIndex: 2, marginTop: 28 }} aria-label="Main navigation">
          {[...NAV_ITEMS, ...(isAdmin ? [{ id: "admin", l: "Support", i: "🛠" }] : [])].map((item) => {
            const active = view === item.id || (item.id === "dash" && view === "detail")
            return (
              <button
                key={item.id}
                onClick={() => nav(item.id)}
                aria-current={active ? "page" : undefined}
                className={!active ? "sidebar-nav" : ""}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  padding: "9px 10px",
                  background: active ? "rgba(255,255,255,0.13)" : "transparent",
                  border: "none",
                  borderRadius: 7,
                  color: active ? "#fff" : "rgba(255,255,255,0.5)",
                  fontFamily: FONT,
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  marginBottom: 3,
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ width: 17, textAlign: "center", fontSize: 12 }} aria-hidden="true">{item.i}</span>
                {item.l}
              </button>
            )
          })}
        </nav>

        <a
          href="mailto:support@hielda.com"
          style={{
            display: "block", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.45)",
            padding: "6px 8px", marginBottom: 6, borderRadius: 7, textDecoration: "none",
            position: "relative", zIndex: 2,
          }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.75)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.45)"}
        >
          Contact Support
        </a>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", padding: "0 8px", marginBottom: 8, position: "relative", zIndex: 2, textAlign: "center" }}>
          {profile?.email || user?.email}
        </div>
        <button
          onClick={logout}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 7,
            padding: "8px 10px",
            color: "rgba(255,255,255,0.5)",
            fontFamily: FONT,
            fontSize: 11,
            cursor: "pointer",
            textAlign: "center",
            position: "relative",
            zIndex: 2,
          }}
        >
          Log out
        </button>
        <img src="/shield-f2-single.png?v=2" alt="" style={{ position: "absolute", top: "43%", left: "50%", transform: "translate(-50%, -50%)", width: 120, opacity: 0.13, pointerEvents: "none", zIndex: 1 }} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxHeight: "100vh", minWidth: 0 }}>
        {/* Header */}
        <header style={{ flexShrink: 0, padding: isMobile ? "10px 16px" : "10px 28px", borderBottom: `1px solid ${c.bd}`, background: c.sf, display: "flex", alignItems: "center", zIndex: 2, minHeight: 54, gap: 10 }}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: "4px 8px", color: c.tx }}
              aria-label="Open menu"
            >
              ☰
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: c.ac, color: "#fff", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, fontFamily: FONT }}>
              {(profile?.full_name || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            {!isMobile && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.tx }}>{profile?.business_name || profile?.full_name || "Welcome"}</div>
                {profile?.business_name && profile?.full_name && (
                  <div style={{ fontSize: 11, color: c.td }}>{profile.full_name}</div>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 10 }}>
            {overdueInvs.length > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.ord, color: c.or, border: `1px solid ${c.or}20` }}>
                <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, height: 10, marginRight: 7 }}>
                  <span className="header-pulse" />
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.or, position: "relative", zIndex: 1 }} />
                </span>
                {overdueInvs.length} chasing{!isMobile && ` · ${fmt(overdueInvs.reduce((s, i) => s + Number(i.amount), 0))}`}
              </div>
            )}
            {pendingInvs.length > 0 && !isMobile && (
              <div style={{ display: "inline-flex", alignItems: "center", padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.amd, color: c.am, border: `1px solid ${c.am}20` }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.am, marginRight: 7 }} />
                {pendingInvs.length} pending
              </div>
            )}
            {overdueInvs.length === 0 && pendingInvs.length === 0 && !isMobile && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 500, color: c.td, border: `1px solid ${c.bd}`, background: c.sf }}>
                <span style={{ color: c.gn }}>✓</span> All clear — no outstanding invoices
              </div>
            )}
          </div>

          {!isMobile && (
            <div style={{ fontSize: 12, color: c.tm }}>
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: isMobile ? "20px 16px" : "28px 32px", overflowY: "auto", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.25, backgroundImage: "radial-gradient(circle,#b0bcc8 0.5px,transparent 0.5px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <SubscriptionGate subscription={subscription} onUpgrade={() => nav("billing")}>
              {dataError && (
                <div role="alert" style={{ padding: "12px 16px", background: c.ord, color: c.or, borderRadius: 8, fontSize: 13, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{dataError}</span>
                  <button onClick={loadData} style={{ background: c.or, color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    Retry
                  </button>
                </div>
              )}
              {view === "dash" && <Dashboard invs={invs} nav={nav} isMobile={isMobile} onUpdate={loadData} profile={profile} />}
              {view === "detail" && <Detail inv={sel} nav={nav} profile={profile} onUpdate={loadData} isMobile={isMobile} />}
              {view === "create" && <Create profile={profile} nav={nav} userId={user?.id} onCreated={loadData} isMobile={isMobile} invs={invs} />}
              {view === "settings" && <Settings profile={profile} onUpdate={loadData} isMobile={isMobile} />}
              {view === "how" && <HowItWorks isMobile={isMobile} />}
              {view === "referrals" && <Referrals profile={profile} userId={user?.id} isMobile={isMobile} />}
              {view === "billing" && <Billing subscription={subscription} userId={user?.id} onUpdate={loadData} isMobile={isMobile} />}
              {view === "admin" && isAdmin && <AdminDashboard isMobile={isMobile} />}
            </SubscriptionGate>
            {showTour && <OnboardingTour userId={user?.id} onDone={() => setShowTour(false)} />}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: .4 } 100% { transform: scale(2.2); opacity: 0 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(30,95,160,0.15); }
        :focus-visible { outline: 2px solid ${c.ac}; outline-offset: 2px; }
        button:focus:not(:focus-visible) { outline: none; }
        .pulse-ring { position: absolute; inset: -3px; border-radius: 50%; border: 1.5px solid ${c.ac}; opacity: .4; animation: pulse-ring 2s ease-out infinite; }
        .header-pulse { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: ${c.or}; opacity: 0.3; animation: pulse-ring 2s ease-out infinite; }
        .sidebar-nav:hover { background: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.8) !important; }
        .table-row-hover:hover { background: ${c.sfh}; }
        .table-row-hover:focus { outline: 2px solid ${c.ac}; outline-offset: -2px; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${c.bg}; }
        ::-webkit-scrollbar-thumb { background: ${c.bd}; border-radius: 3px; }
      `}</style>
    </div>
  )
}
