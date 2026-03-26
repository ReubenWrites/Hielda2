import { describe, it, expect } from 'vitest'
import { penalty, calcInterest, fmt, formatDate, addDays, generateRef, daysLate, todayStr, isValidEmail } from '../utils'

describe('penalty', () => {
  it('returns £40 for invoices under £1,000', () => {
    expect(penalty(500)).toBe(40)
    expect(penalty(999.99)).toBe(40)
  })

  it('returns £70 for invoices £1,000-£9,999', () => {
    expect(penalty(1000)).toBe(70)
    expect(penalty(5000)).toBe(70)
    expect(penalty(9999.99)).toBe(70)
  })

  it('returns £100 for invoices £10,000+', () => {
    expect(penalty(10000)).toBe(100)
    expect(penalty(50000)).toBe(100)
  })
})

describe('calcInterest', () => {
  it('calculates daily compound interest correctly', () => {
    const interest = calcInterest(1000, 30)
    // RATE = 11.75, DAILY_RATE = 11.75 / 365 / 100
    // 1000 * (11.75 / 365 / 100) * 30
    expect(interest).toBeCloseTo(9.66, 1)
  })

  it('returns 0 for 0 days', () => {
    expect(calcInterest(1000, 0)).toBe(0)
  })

  it('returns 0 for 0 amount', () => {
    expect(calcInterest(0, 30)).toBe(0)
  })
})

describe('fmt', () => {
  it('formats as GBP currency', () => {
    expect(fmt(1234.56)).toBe('£1,234.56')
    expect(fmt(0)).toBe('£0.00')
    expect(fmt(99.9)).toBe('£99.90')
  })
})

describe('formatDate', () => {
  it('formats dates in en-GB format', () => {
    const result = formatDate('2026-03-25')
    expect(result).toContain('25')
    expect(result).toContain('Mar')
    expect(result).toContain('2026')
  })

  it('returns empty string for falsy input', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('')).toBe('')
  })
})

describe('addDays', () => {
  it('adds days to a date', () => {
    const result = addDays('2026-01-01', 30)
    expect(result.toISOString().split('T')[0]).toBe('2026-01-31')
  })

  it('handles negative days', () => {
    const result = addDays('2026-01-31', -30)
    expect(result.toISOString().split('T')[0]).toBe('2026-01-01')
  })
})

describe('generateRef', () => {
  it('generates a ref starting with INV-', () => {
    const ref = generateRef()
    expect(ref).toMatch(/^INV-[A-Z0-9]{6}$/)
  })

  it('generates unique refs', () => {
    const refs = new Set(Array.from({ length: 100 }, generateRef))
    expect(refs.size).toBeGreaterThan(90) // statistically should be all unique
  })
})

describe('daysLate', () => {
  it('returns 0 for future dates', () => {
    const future = new Date()
    future.setDate(future.getDate() + 10)
    expect(daysLate(future.toISOString())).toBe(0)
  })

  it('returns positive days for past dates', () => {
    const past = new Date()
    past.setDate(past.getDate() - 5)
    expect(daysLate(past.toISOString())).toBe(5)
  })
})

describe('todayStr', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('isValidEmail', () => {
  it('validates correct emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('not-an-email')).toBe(false)
    expect(isValidEmail('@domain.com')).toBe(false)
  })
})
