// posthog-js is ~60 KB gzipped and nothing on the page waits for it, so
// it is fetched after the page has painted rather than in the entry chunk.
let posthog = null
const queue = []

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com"

let initialized = false

export function initPostHog() {
  if (!POSTHOG_KEY || initialized) return
  initialized = true
  const start = () => import("posthog-js").then((m) => {
    posthog = m.default
    posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: false, // We fire manually since app uses state-based routing
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    mask_all_text: false,
    mask_all_element_attributes: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-mask]",
    },
    })
    queue.splice(0).forEach((fn) => fn())
  }).catch(() => {})
  if (typeof requestIdleCallback === "function") requestIdleCallback(start, { timeout: 3000 })
  else setTimeout(start, 1500)
}

// Calls made before the SDK has arrived are replayed once it has.
const whenReady = (fn) => { if (posthog) fn(); else if (initialized) queue.push(fn) }

export function identifyUser(profile) {
  if (!initialized || !profile) return
  whenReady(() => posthog.identify(profile.id, {
    email: profile.email,
    name: profile.full_name,
    business: profile.business_name,
    plan: profile.plan || "free",
  }))
}

export function resetUser() {
  if (!initialized) return
  whenReady(() => posthog.reset())
}

export function trackPageView(viewName) {
  if (!initialized) return
  whenReady(() => posthog.capture("$pageview", { view: viewName }))
}

export function trackEvent(name, props) {
  if (!initialized) return
  whenReady(() => posthog.capture(name, props))
  // Fire retargeting pixel conversion events on key actions
  if (name === "sign_up_completed") {
    if (window.gtag) window.gtag("event", "conversion", { send_to: "AW-XXXXXXXXXX" })
    if (window.fbq) window.fbq("track", "CompleteRegistration")
    if (window.lintrk) window.lintrk("track", { conversion_id: 0 })
  }
  if (name === "invoice_created") {
    if (window.fbq) window.fbq("track", "Lead")
  }
}
