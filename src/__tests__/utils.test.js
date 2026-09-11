import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { penalty, calcInterest, fmt, formatDate, addDays, generateRef, daysLate, todayStr, isValidEmail, outstanding, chargeableExtras, accruedInterest } from '../utils'
import { getDailyRate } from '../constants'

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
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 for future dates', () => {
    expect(daysLate('2026-06-25')).toBe(0)
  })

  it('returns positive days for past dates', () => {
    expect(daysLate('2026-06-10')).toBe(5)
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

describe('outstanding', () => {
  it('subtracts partial payments from the amount', () => {
    expect(outstanding({ amount: 1639.55, amount_paid: 1250 })).toBe(389.55)
  })
  it('never goes negative and treats missing amount_paid as zero', () => {
    expect(outstanding({ amount: 100, amount_paid: 150 })).toBe(0)
    expect(outstanding({ amount: 100 })).toBe(100)
  })
})

describe('chargeableExtras', () => {
  const yesterday = () => addDays(new Date(), -30).toISOString().split('T')[0]
  const base = () => ({ status: 'overdue', due_date: yesterday(), amount: 1639.55, amount_paid: 0, paid_before_due: 0 })

  it('is zero unless overdue', () => {
    expect(chargeableExtras({ ...base(), status: 'pending' })).toBe(0)
  })
  it('is zero when fines are waived or client is a consumer', () => {
    expect(chargeableExtras({ ...base(), no_fines: true })).toBe(0)
    expect(chargeableExtras({ ...base(), client_type: 'consumer' })).toBe(0)
  })
  it('charges interest on the outstanding balance', () => {
    const withPayment = { ...base(), amount_paid: 1250 }
    const full = chargeableExtras(base())
    const reduced = chargeableExtras(withPayment)
    expect(reduced).toBeLessThan(full)
    expect(reduced).toBeGreaterThan(0)
  })
  it('tiers the fixed fee on the debt at the due date, not the invoice amount', () => {
    // Paid down to £389.55 BEFORE the due date: £40 tier applies.
    const preDue = { ...base(), amount_paid: 1250, paid_before_due: 1250 }
    const expected = calcInterest(389.55, daysLate(preDue.due_date)) + 40
    expect(chargeableExtras(preDue)).toBeCloseTo(expected, 2)
    // Same payment AFTER the due date: the £70 tier crystallised.
    const postDue = { ...base(), amount_paid: 1250, paid_before_due: 0 }
    const expectedPost = calcInterest(389.55, daysLate(postDue.due_date)) + 70
    expect(chargeableExtras(postDue)).toBeCloseTo(expectedPost, 2)
  })
  it('charges nothing once fully paid', () => {
    expect(chargeableExtras({ ...base(), amount_paid: 1639.55 })).toBe(0)
  })
  it('accrues period by period when the ledger is supplied', () => {
    const inv = { ...base(), amount_paid: 1250 }
    const ledger = [{ amount: 1250, paid_on: todayStr() }]
    // The payment landed today, so almost the whole 30 days accrued on the
    // full £1,639.55 — far more than the flat figure on today's balance.
    expect(chargeableExtras(inv, ledger)).toBeGreaterThan(chargeableExtras(inv))
  })
})

describe('accruedInterest', () => {
  const dr = () => getDailyRate()

  it('is zero before the due date', () => {
    const inv = { amount: 1000, due_date: '2026-07-23', amount_paid: 0 }
    expect(accruedInterest(inv, [], '2026-07-23')).toBe(0)
    expect(accruedInterest(inv, [], '2026-07-01')).toBe(0)
  })

  it('matches the flat calculation when nothing has been paid', () => {
    const inv = { amount: 1000, due_date: '2026-07-23', amount_paid: 0 }
    expect(accruedInterest(inv, [], '2026-08-22')).toBeCloseTo(1000 * dr() * 30, 2)
  })

  it('falls back to the flat calculation when no ledger is supplied', () => {
    const inv = { amount: 1000, due_date: '2026-07-23', amount_paid: 400 }
    expect(accruedInterest(inv, undefined, '2026-08-22')).toBeCloseTo(600 * dr() * 30, 2)
  })

  // Regression: INV-0005 from the live books. A £1,418.45 invoice sat unpaid
  // for 40 days, was part-paid twice, then settled. The old flat model
  // charged £3.16 because it applied the FINAL £200.61 balance to all 49
  // days. The real figure is £21.42, and the invoice closed £18 short.
  it('does not let a late part-payment erase interest already accrued', () => {
    const inv = { amount: 1418.45, due_date: '2026-07-23', amount_paid: 1491.61 }
    const ledger = [
      { amount: 217.84, paid_on: '2026-09-01' },
      { amount: 1000, paid_on: '2026-09-09' },
      { amount: 273.77, paid_on: '2026-09-10' },
    ]
    const expected = 1418.45 * dr() * 40 + 1200.61 * dr() * 8 + 200.61 * dr() * 1
    const actual = accruedInterest(inv, ledger, '2026-09-10')
    expect(actual).toBeCloseTo(expected, 2)
    expect(actual).toBeCloseTo(21.42, 1)
    // The flat model's answer, for contrast — never produce this again.
    expect(actual).toBeGreaterThan(200.61 * dr() * 49)
  })

  it('does not accrue on payments made on or before the due date', () => {
    const inv = { amount: 1639.55, due_date: '2026-07-25', amount_paid: 1250 }
    const ledger = [{ amount: 1250, paid_on: '2026-07-24' }]
    // Only the £389.55 that actually went overdue accrues.
    expect(accruedInterest(inv, ledger, '2026-09-01')).toBeCloseTo(389.55 * dr() * 38, 2)
  })

  it('treats a payment on the due date itself as pre-due', () => {
    const inv = { amount: 1199.97, due_date: '2026-08-12', amount_paid: 695.4 }
    const ledger = [{ amount: 695.4, paid_on: '2026-08-12' }]
    expect(accruedInterest(inv, ledger, '2026-09-01')).toBeCloseTo(504.57 * dr() * 20, 2)
  })

  it('stops the meter at zero when a payment covers principal and charges', () => {
    const inv = { amount: 1000, due_date: '2026-07-23', amount_paid: 1100 }
    const ledger = [{ amount: 1100, paid_on: '2026-08-02' }]
    // 10 days on £1,000, then nothing — the £100 excess is paying charges,
    // it must not push the balance negative and claw interest back.
    expect(accruedInterest(inv, ledger, '2026-09-30')).toBeCloseTo(1000 * dr() * 10, 2)
  })

  it('ignores payments dated after the as-of date', () => {
    const inv = { amount: 1000, due_date: '2026-07-23', amount_paid: 400 }
    const ledger = [{ amount: 400, paid_on: '2026-09-20' }]
    expect(accruedInterest(inv, ledger, '2026-08-22')).toBeCloseTo(1000 * dr() * 30, 2)
  })

  it('handles unsorted ledger rows', () => {
    const inv = { amount: 1000, due_date: '2026-07-23', amount_paid: 600 }
    const sorted = [{ amount: 300, paid_on: '2026-08-02' }, { amount: 300, paid_on: '2026-08-12' }]
    const shuffled = [sorted[1], sorted[0]]
    expect(accruedInterest(inv, shuffled, '2026-09-01')).toBeCloseTo(
      accruedInterest(inv, sorted, '2026-09-01'), 2)
  })
})
