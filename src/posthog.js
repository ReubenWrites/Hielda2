import posthog from "posthog-js"

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com"

let initialized = false

export function initPostHog() {
  if (!POSTHOG_KEY || initialized) return
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
  initialized = true
}

export function identifyUser(profile) {
  if (!initialized || !profile) return
  posthog.identify(profile.id, {
    email: profile.email,
    name: profile.full_name,
    business: profile.business_name,
    plan: profile.plan || "free",
  })
}

export function resetUser() {
  if (!initialized) return
  posthog.reset()
}

export function trackPageView(viewName) {
  if (!initialized) return
  posthog.capture("$pageview", { view: viewName })
}

export function trackEvent(name, props) {
  if (!initialized) return
  posthog.capture(name, props)
}
