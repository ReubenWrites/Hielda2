import { useState, useEffect, useCallback, lazy, Suspense } from "react"
import { Routes, Route, Navigate, useNavigate, useLocation, useParams, useSearchParams } from "react-router-dom"
import { supabase } from "./supabase"
import { loadLiveBoeRate } from "./constants"
import { fmt, todayStr } from "./utils"
import { identifyUser, resetUser, trackPageView, trackEvent } from "./posthog"
import { ShieldLogo, Spinner } from "./components/ui"
import AuthScreen from "./components/AuthScreen"
import Dashboard from "./components/Dashboard"
import SubscriptionGate from "./components/SubscriptionGate"
const shouldShowTour = (userId) => { try { return !localStorage.getItem(`hielda_tour_done_${userId}`) } catch { return false } }
import s from "./App.module.css"

// Lazy-loaded routes
const Onboarding = lazy(() => import("./components/Onboarding"))
const Detail = lazy(() => import("./components/Detail"))
const Create = lazy(() => import("./components/Create"))
const Settings = lazy(() => import("./components/Settings"))
const HowItWorks = lazy(() => import("./components/HowItWorks"))
const Billing = lazy(() => import("./components/Billing"))
const LandingPage = lazy(() => import("./components/LandingPage"))
const Calculator = lazy(() => import("./components/Calculator"))
const PrivacyPolicy = lazy(() => import("./components/PrivacyPolicy"))
const AdminDashboard = lazy(() => import("./components/AdminDashboard"))
const Referrals = lazy(() => import("./components/Referrals"))
const NotificationDropdown = lazy(() => import("./components/NotificationDropdown"))
const OnboardingTour = lazy(() => import("./components/OnboardingTour"))

const PageLoader = () => (
  <div className={s.pageLoader}>
    <Spinner size={24} />
  </div>
)

const NAV_ITEMS = [
  { id: "dash", l: "Dashboard", i: "◉", path: "/dashboard" },
  { id: "create", l: "New Invoice", i: "+", path: "/create" },
  { id: "referrals", l: "Refer & Earn", i: "♦", path: "/referrals" },
  { id: "how", l: "How It Works", i: "?", path: "/how" },
  { id: "settings", l: "Your Details", i: "⚙", path: "/settings" },
  { id: "billing", l: "Your Account", i: "○", path: "/billing" },
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

/** Wrapper for Detail — reads invoice ID from URL params */
function DetailRoute({ invs, profile, onUpdate, isMobile }) {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const inv = invs.find((i) => i.id === id)
  const editChase = searchParams.get("edit_chase") === "true"

  if (!inv) {
    return (
      <div className={s.notFound}>
        <p className={s.notFoundText}>Invoice not found.</p>
        <button onClick={() => navigate("/dashboard")} className={s.notFoundBtn}>
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <Detail
      inv={inv}
      profile={profile}
      onUpdate={onUpdate}
      isMobile={isMobile}
      editChase={editChase}
      onEditChaseDone={() => setSearchParams({}, { replace: true })}
    />
  )
}

/** Handles /ref/:code — stores referral code and redirects to home */
function ReferralRedirect() {
  const { code } = useParams()
  const navigate = useNavigate()
  useEffect(() => {
    if (code) {
      localStorage.setItem("hielda_referral_code", code)
      trackEvent("referral_link_visited", { code })
    }
    navigate("/", { replace: true })
  }, [code, navigate])
  return null
}

/** Handles legacy deep-link: ?invoice=ID&edit_chase=true */
function LegacyDeepLink() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const invoiceId = searchParams.get("invoice")
  const editChase = searchParams.get("edit_chase") === "true"

  useEffect(() => {
    if (invoiceId) {
      const target = editChase ? `/invoice/${invoiceId}?edit_chase=true` : `/invoice/${invoiceId}`
      navigate(target, { replace: true })
    }
  }, [invoiceId, editChase, navigate])

  return null
}

export default function App() {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [invs, setInvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showTour, setShowTour] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  const isMobile = useMediaQuery("(max-width: 768px)")
  const isAdmin = (profile?.email || user?.email) === import.meta.env.VITE_ADMIN_EMAIL

  // Navigate to /privacy on custom event
  useEffect(() => {
    const handler = () => navigate("/privacy")
    window.addEventListener("hielda:show-privacy", handler)
    return () => window.removeEventListener("hielda:show-privacy", handler)
  }, [navigate])

  // Sync page title with route
  useEffect(() => {
    if (session) return
    const path = location.pathname
    let title, desc
    if (path === "/calculator") {
      title = "UK Late Payment Calculator — Hielda"
      desc = "Calculate statutory interest and penalties on overdue invoices. Free tool for UK freelancers under the Late Payment Act 1998."
    } else if (path === "/privacy") {
      title = "Privacy Policy — Hielda"
      desc = "Hielda privacy policy — how we collect, use, and protect your data."
    } else if (path === "/auth") {
      title = "Start Free Trial — Hielda"
      desc = "6-week free trial, no credit card required. Automatic invoice chasing and late payment enforcement for UK freelancers."
    } else {
      title = "Hielda — Invoice Chasing & Late Payment Enforcement for UK Freelancers"
      desc = "Automatically chase late invoices and enforce statutory interest and penalties under UK law. For freelancers and SMEs."
    }
    document.title = title
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute("content", desc)
  }, [location.pathname, session])

  // Track page views on route changes
  useEffect(() => {
    if (session) trackPageView(location.pathname)
  }, [location.pathname, session])

  // Load live BoE rate on mount
  useEffect(() => { loadLiveBoeRate() }, [])

  // Capture UTM parameters on first visit
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
    const utms = {}
    utmKeys.forEach((k) => { if (params.get(k)) utms[k] = params.get(k) })
    if (Object.keys(utms).length > 0) {
      localStorage.setItem("hielda_utm", JSON.stringify(utms))
      trackEvent("utm_visit", utms)
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
        supabase.from("invoices").select("id,ref,description,status,due_date,issue_date,amount,amount_paid,subtotal,vat_amount,total_with_vat,client_name,client_email,client_address,chase_stage,created_at,auto_chase,no_fines,client_type,payment_term_days,send_method,line_items,client_ref,cc_emails,bcc_emails,paid_date,dispute_reason,dispute_notes,dispute_date,resolution_outcome,resolution_notes,resolution_date").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
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

  const logout = async () => {
    await supabase.auth.signOut()
    resetUser()
    setSession(null)
    setUser(null)
    setProfile(null)
    setSubscription(null)
    setInvs([])
    navigate("/")
  }

  // Pre-compute header stats
  const overdueInvs = invs.filter((i) => i.status === "overdue")
  const pendingInvs = invs.filter((i) => i.status === "pending")

  if (loading) {
    return (
      <div className={s.loadingScreen}>
        <Spinner size={28} />
        <span className={s.loadingText}>Loading your invoices...</span>
      </div>
    )
  }

  // ── Public (unauthenticated) routes ──
  if (!session) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/calculator" element={<Calculator onBack={() => navigate("/")} onGetStarted={() => { trackPageView("auth"); navigate("/auth") }} isMobile={isMobile} />} />
          <Route path="/privacy" element={<PrivacyPolicy onBack={() => navigate("/")} />} />
          <Route path="/auth" element={<AuthScreen onAuth={handleAuth} onBack={() => navigate("/")} />} />
          <Route path="/ref/:code" element={<ReferralRedirect />} />
          <Route path="*" element={<LandingPage onGetStarted={() => { trackPageView("auth"); navigate("/auth") }} onPrivacy={() => { trackPageView("privacy"); navigate("/privacy") }} onCalculator={() => { trackPageView("calculator"); navigate("/calculator") }} isMobile={isMobile} />} />
        </Routes>
      </Suspense>
    )
  }

  // ── Onboarding gate ──
  if (!profile || !profile.onboarding_complete) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Onboarding
          user={user}
          profile={profile}
          onComplete={() => { loadData(); navigate("/dashboard") }}
        />
      </Suspense>
    )
  }

  // ── Authenticated layout ──
  return (
    <div className={s.layout}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className={s.overlay} />
      )}

      {/* Sidebar */}
      <div className={`${s.sidebar}${isMobile && sidebarOpen ? ` ${s.sidebarOpen}` : ""}`}>
        <div className={s.sidebarLogo}>
          <ShieldLogo size={36} white />
          <div>
            <div className={s.sidebarBrand}>Hielda</div>
            <div className={s.sidebarTagline}>Protecting your pay.</div>
          </div>
        </div>

        <nav className={s.sidebarNav} aria-label="Main navigation">
          {[...NAV_ITEMS, ...(isAdmin ? [{ id: "admin", l: "Support", i: "🛠", path: "/admin" }] : [])].map((item) => {
            const active = location.pathname === item.path || (item.id === "dash" && location.pathname.startsWith("/invoice/"))
            return (
              <button
                key={item.id}
                onClick={() => { navigate(item.path); if (isMobile) setSidebarOpen(false) }}
                aria-current={active ? "page" : undefined}
                className={active ? s.navBtnActive : s.navBtn}
              >
                <span className={s.navIcon} aria-hidden="true">{item.i}</span>
                {item.l}
              </button>
            )
          })}
        </nav>

        <a href="mailto:support@hielda.com" className={s.supportLink}>
          Contact Support
        </a>
        <div className={s.sidebarEmail}>
          {profile?.email || user?.email}
        </div>
        <button onClick={logout} className={s.logoutBtn}>
          Log out
        </button>
        <img src="/shield-f2-single.png?v=2" alt="" className={s.sidebarBg} />
      </div>

      {/* Main content */}
      <div className={s.mainCol}>
        {/* Header */}
        <header className={s.header}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} className={s.hamburger} aria-label="Open menu">
              ☰
            </button>
          )}

          <div className={s.avatarRow}>
            <div className={s.avatar}>
              {(profile?.full_name || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            {!isMobile && (
              <div>
                <div className={s.headerName}>{profile?.business_name || profile?.full_name || "Welcome"}</div>
                {profile?.business_name && profile?.full_name && (
                  <div className={s.headerSub}>{profile.full_name}</div>
                )}
              </div>
            )}
          </div>

          <div className={s.headerStats}>
            {overdueInvs.length > 0 && (
              <div className={s.badgeOverdue}>
                <span className={s.pulseWrap}>
                  <span className="header-pulse" />
                  <span className={s.pulseDot} />
                </span>
                {overdueInvs.length} chasing{!isMobile && ` · ${fmt(overdueInvs.reduce((s, i) => s + Number(i.amount), 0))}`}
              </div>
            )}
            {pendingInvs.length > 0 && !isMobile && (
              <div className={s.badgePending}>
                <span className={s.pendingDot} />
                {pendingInvs.length} pending
              </div>
            )}
            {overdueInvs.length === 0 && pendingInvs.length === 0 && !isMobile && (
              <div className={s.badgeClear}>
                <span className={s.clearCheck}>✓</span> All clear — no outstanding invoices
              </div>
            )}
          </div>

          <Suspense fallback={null}>
            <NotificationDropdown userId={user?.id} />
          </Suspense>

          {!isMobile && (
            <div className={s.headerDate}>
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
        </header>

        {/* Content */}
        <main className={s.content}>
          <div className={s.dotPattern} />
          <div className={s.contentInner}>
            <SubscriptionGate subscription={subscription} onUpgrade={() => navigate("/billing")}>
              {dataError && (
                <div role="alert" className={s.errorBanner}>
                  <span>{dataError}</span>
                  <button onClick={loadData} className={s.retryBtn}>
                    Retry
                  </button>
                </div>
              )}
              <LegacyDeepLink />
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/dashboard" element={<Dashboard invs={invs} onUpdate={loadData} isMobile={isMobile} profile={profile} />} />
                <Route path="/invoice/:id" element={<DetailRoute invs={invs} profile={profile} onUpdate={loadData} isMobile={isMobile} />} />
                <Route path="/create" element={<Create profile={profile} userId={user?.id} onCreated={loadData} isMobile={isMobile} invs={invs} />} />
                <Route path="/settings" element={<Settings profile={profile} onUpdate={loadData} isMobile={isMobile} />} />
                <Route path="/how" element={<HowItWorks isMobile={isMobile} />} />
                <Route path="/referrals" element={<Referrals profile={profile} userId={user?.id} isMobile={isMobile} />} />
                <Route path="/billing" element={<Billing subscription={subscription} userId={user?.id} onUpdate={loadData} isMobile={isMobile} />} />
                {isAdmin && <Route path="/admin" element={<AdminDashboard isMobile={isMobile} />} />}
                <Route path="/privacy" element={<PrivacyPolicy onBack={() => navigate("/dashboard")} />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              </Suspense>
            </SubscriptionGate>
            {showTour && <OnboardingTour userId={user?.id} onDone={() => setShowTour(false)} />}
          </div>
        </main>
      </div>

    </div>
  )
}
