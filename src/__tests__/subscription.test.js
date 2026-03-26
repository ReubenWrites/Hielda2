import { describe, it, expect } from 'vitest'
import { getTrialDaysRemaining, isSubscriptionActive, shouldShowPaywall } from '../lib/subscription'

describe('getTrialDaysRemaining', () => {
  it('returns 0 for null subscription', () => {
    expect(getTrialDaysRemaining(null)).toBe(0)
  })

  it('returns 0 for non-trialing subscription', () => {
    expect(getTrialDaysRemaining({ status: 'active', trial_end: new Date().toISOString() })).toBe(0)
  })

  it('returns correct days for active trial', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 5)
    const days = getTrialDaysRemaining({ status: 'trialing', trial_end: futureDate.toISOString() })
    expect(days).toBe(5)
  })

  it('returns 0 for expired trial', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    const days = getTrialDaysRemaining({ status: 'trialing', trial_end: pastDate.toISOString() })
    expect(days).toBe(0)
  })
})

describe('isSubscriptionActive', () => {
  it('returns true for null (dev mode)', () => {
    expect(isSubscriptionActive(null)).toBe(true)
  })

  it('returns true for active subscription', () => {
    expect(isSubscriptionActive({ status: 'active' })).toBe(true)
  })

  it('returns true for valid trial', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 3)
    expect(isSubscriptionActive({ status: 'trialing', trial_end: futureDate.toISOString() })).toBe(true)
  })

  it('returns false for expired trial', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    expect(isSubscriptionActive({ status: 'trialing', trial_end: pastDate.toISOString() })).toBe(false)
  })

  it('returns false for canceled subscription', () => {
    expect(isSubscriptionActive({ status: 'canceled' })).toBe(false)
  })

  it('returns false for past_due subscription', () => {
    expect(isSubscriptionActive({ status: 'past_due' })).toBe(false)
  })
})

describe('shouldShowPaywall', () => {
  it('returns false for null (dev mode)', () => {
    expect(shouldShowPaywall(null)).toBe(false)
  })

  it('returns false for active subscription', () => {
    expect(shouldShowPaywall({ status: 'active' })).toBe(false)
  })

  it('returns true for expired trial', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    expect(shouldShowPaywall({ status: 'trialing', trial_end: pastDate.toISOString() })).toBe(true)
  })
})
