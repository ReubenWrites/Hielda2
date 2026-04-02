export const TRIAL_DAYS = 42

export function getTrialDaysRemaining(sub) {
  if (!sub || sub.status !== "trialing") return 0
  const end = new Date(sub.trial_end)
  return Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24)))
}

export function isSubscriptionActive(sub) {
  if (!sub) return true // No subscription = dev/free mode
  if (sub.status === "active") return true
  if (sub.status === "trialing") return new Date(sub.trial_end) > new Date()
  return false
}

export function shouldShowPaywall(sub) {
  if (!sub) return false
  return !isSubscriptionActive(sub)
}
