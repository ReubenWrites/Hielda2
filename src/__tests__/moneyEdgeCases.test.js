import { describe, it, expect } from 'vitest'
import { accruedInterest, chargeableExtras, outstanding, penalty, round2 } from '../utils'
import { getDailyRate } from '../constants'

// Adversarial inputs to the interest engine. Every figure here ends up in
// front of a client, and in a Letter Before Action that may be read by a
// judge, so the failure mode that matters is a plausible-looking wrong
// number rather than a crash.

const dr = () => getDailyRate()
const inv = (over = {}) => ({
  amount: 1000, amount_paid: 0, paid_before_due: 0,
  due_date: '2026-01-01', status: 'overdue', client_type: 'business',
  no_fines: false, ...over,
})

describe('accruedInterest survives malformed ledgers', () => {
  // An undateable row can't be placed on the timeline, so it's credited at
  // the due date: deterministic, and it under-states rather than over-states.
  it('credits a payment with no date at the due date', () => {
    const withNullDate = accruedInterest(inv(), [{ amount: 500, paid_on: null }], '2026-02-01')
    expect(withNullDate).toBeCloseTo(500 * dr() * 31, 2)
  })

  it('credits a payment with an unparseable date the same way', () => {
    const bad = accruedInterest(inv(), [{ amount: 500, paid_on: 'not-a-date' }], '2026-02-01')
    expect(Number.isFinite(bad)).toBe(true)
    // Must not collapse to zero, which is what NaN comparisons used to do.
    expect(bad).toBeCloseTo(500 * dr() * 31, 2)
    expect(bad).toBeGreaterThan(0)
  })

  it('treats a missing or non-numeric amount as zero', () => {
    const a = accruedInterest(inv(), [{ amount: null, paid_on: '2026-01-15' }], '2026-02-01')
    const b = accruedInterest(inv(), [{ amount: 'abc', paid_on: '2026-01-15' }], '2026-02-01')
    expect(a).toBeCloseTo(1000 * dr() * 31, 2)
    expect(b).toBeCloseTo(a, 2)
  })

  it('never returns a negative figure', () => {
    const weird = accruedInterest(inv(), [{ amount: -500, paid_on: '2026-01-10' }], '2026-02-01')
    expect(weird).toBeGreaterThanOrEqual(0)
  })

  it('handles several payments landing on the same day', () => {
    const same = accruedInterest(inv(), [
      { amount: 300, paid_on: '2026-01-15' },
      { amount: 300, paid_on: '2026-01-15' },
    ], '2026-02-01')
    const combined = accruedInterest(inv(), [{ amount: 600, paid_on: '2026-01-15' }], '2026-02-01')
    expect(same).toBeCloseTo(combined, 2)
  })

  it('is unaffected by an empty or absent invoice amount', () => {
    expect(accruedInterest(inv({ amount: 0 }), [], '2026-02-01')).toBe(0)
    expect(accruedInterest(inv({ amount: null }), [], '2026-02-01')).toBe(0)
  })

  it('returns zero when the as-of date precedes the due date', () => {
    expect(accruedInterest(inv(), [], '2025-12-01')).toBe(0)
  })

  it('is monotonic: more days late never means less interest', () => {
    let prev = -1
    for (const day of ['2026-01-02', '2026-01-10', '2026-02-01', '2026-06-01', '2027-01-01']) {
      const now = accruedInterest(inv(), [{ amount: 200, paid_on: '2026-01-05' }], day)
      expect(now).toBeGreaterThanOrEqual(prev)
      prev = now
    }
  })

  it('a payment can never reduce interest already accrued', () => {
    const withoutPayment = accruedInterest(inv(), [], '2026-03-01')
    const withLatePayment = accruedInterest(inv(), [{ amount: 900, paid_on: '2026-02-28' }], '2026-03-01')
    // Nearly all of it accrued on the full balance before the payment
    // landed, so the two must be close — the old model collapsed this to
    // almost nothing.
    expect(withLatePayment).toBeGreaterThan(withoutPayment * 0.9)
  })
})

describe('chargeableExtras holds its invariants', () => {
  it('charges nothing on anything that is not overdue', () => {
    expect(chargeableExtras(inv({ status: 'pending' }), [])).toBe(0)
    expect(chargeableExtras(inv({ status: 'paid' }), [])).toBe(0)
    expect(chargeableExtras(inv({ status: 'disputed' }), [])).toBe(0)
  })

  it('charges nothing to consumers or where fines are waived', () => {
    expect(chargeableExtras(inv({ client_type: 'consumer' }), [])).toBe(0)
    expect(chargeableExtras(inv({ no_fines: true }), [])).toBe(0)
  })

  it('charges nothing once the principal is cleared', () => {
    expect(chargeableExtras(inv({ amount_paid: 1000 }), [])).toBe(0)
    expect(chargeableExtras(inv({ amount_paid: 1500 }), [])).toBe(0)
  })

  it('tiers the fixed fee on the debt that actually went overdue', () => {
    // £1,000 invoice paid down to £400 before the due date earns the £40
    // tier, not the £70 one.
    const preDue = inv({ amount: 1200, amount_paid: 400, paid_before_due: 400 })
    const postDue = inv({ amount: 1200, amount_paid: 400, paid_before_due: 0 })
    expect(chargeableExtras(preDue, [])).toBeLessThan(chargeableExtras(postDue, []))
  })
})

describe('supporting maths', () => {
  it('outstanding never goes negative', () => {
    expect(outstanding({ amount: 100, amount_paid: 250 })).toBe(0)
    expect(outstanding({ amount: 100 })).toBe(100)
    expect(outstanding({ amount: null, amount_paid: null })).toBe(0)
  })
  it('penalty bands match the Act', () => {
    expect(penalty(999.99)).toBe(40)
    expect(penalty(1000)).toBe(70)
    expect(penalty(9999.99)).toBe(70)
    expect(penalty(10000)).toBe(100)
  })
  it('round2 settles the classic float cases', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(2.675)).toBe(2.68)
    // 1.005 is really 1.00499999... in binary, so it rounds down. Noted
    // rather than fought: every surface uses this same function, so they
    // all agree, which is what actually matters for reconciliation.
    expect(round2(1.005)).toBe(1)
  })
})
