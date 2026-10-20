import { describe, it, expect } from 'vitest'
import {
  BASE_RATE_HISTORY, baseRateOn, referenceDateFor, statutoryRateFor, dailyRateFor,
  mergeBaseRateHistory, setBaseRateHistory, getBaseRateHistory,
} from '../../api/_baseRates.js'

// The Late Payment of Commercial Debts (Rate of Interest) (No. 3) Order
// 2002: 8% over the base rate on 30 June (interest starting 1 Jul-31 Dec)
// or 31 December (starting 1 Jan-30 Jun). Interest starts the day after
// the due date.
describe('reference rate under the 2002 Order', () => {
  it('uses 30 June for interest starting in the second half of the year', () => {
    expect(referenceDateFor('2024-10-16')).toBe('2024-06-30')
    expect(referenceDateFor('2024-07-01')).toBe('2024-06-30')
    expect(referenceDateFor('2024-12-31')).toBe('2024-06-30')
  })
  it('uses the previous 31 December for interest starting in the first half', () => {
    expect(referenceDateFor('2025-01-01')).toBe('2024-12-31')
    expect(referenceDateFor('2025-06-30')).toBe('2024-12-31')
  })
  it('reads the base rate in force on a date from the history', () => {
    expect(baseRateOn('2024-06-30')).toBe(5.25)   // held since 3 Aug 2023
    expect(baseRateOn('2024-12-31')).toBe(4.75)   // cut 7 Nov 2024
    expect(baseRateOn('2025-06-30')).toBe(4.25)   // cut 8 May 2025
    expect(baseRateOn('2025-12-31')).toBe(3.75)   // cut 18 Dec 2025
    expect(baseRateOn('2017-01-01')).toBe(0.75)   // before the table: earliest entry
  })
  it('fixes the statutory rate by the half-year in which interest starts', () => {
    expect(statutoryRateFor('2024-10-15')).toBe(13.25) // starts 16 Oct 2024 -> 30 Jun 2024 -> 5.25
    expect(statutoryRateFor('2025-01-10')).toBe(12.75) // starts 11 Jan 2025 -> 31 Dec 2024 -> 4.75
    expect(statutoryRateFor('2025-09-01')).toBe(12.25) // starts 2 Sep 2025 -> 30 Jun 2025 -> 4.25
    expect(statutoryRateFor('2026-03-01')).toBe(11.75) // starts 2 Mar 2026 -> 31 Dec 2025 -> 3.75
  })
  it('treats a 30 June due date as interest starting 1 July (30 June reference)', () => {
    // Due 30 Jun 2025 -> starts 1 Jul 2025 -> reference 30 Jun 2025 = 4.25
    expect(statutoryRateFor('2025-06-30')).toBe(12.25)
    // Due 29 Jun 2025 -> starts 30 Jun 2025 -> reference 31 Dec 2024 = 4.75
    expect(statutoryRateFor('2025-06-29')).toBe(12.75)
  })
  it('daily rate is the annual rate over 365', () => {
    expect(dailyRateFor('2026-03-01')).toBeCloseTo(11.75 / 365 / 100, 12)
  })
  it('falls back to the latest rate for a missing or invalid due date', () => {
    expect(statutoryRateFor(null)).toBe(8 + BASE_RATE_HISTORY[BASE_RATE_HISTORY.length - 1].rate)
    expect(statutoryRateFor('not a date')).toBe(8 + BASE_RATE_HISTORY[BASE_RATE_HISTORY.length - 1].rate)
  })
  it('merges fetched changes without losing the static table, and setHistory never shortens it', () => {
    const merged = mergeBaseRateHistory([{ from: '2027-02-04', rate: 3.5 }, { from: '2025-12-18', rate: 3.75 }])
    expect(merged.length).toBe(BASE_RATE_HISTORY.length + 1)
    expect(merged[merged.length - 1]).toEqual({ from: '2027-02-04', rate: 3.5 })
    setBaseRateHistory([{ from: '2027-02-04', rate: 3.5 }]) // too short: ignored
    expect(getBaseRateHistory()).toBe(BASE_RATE_HISTORY)
    setBaseRateHistory(merged)
    expect(statutoryRateFor('2027-09-01')).toBe(11.5)
    setBaseRateHistory(BASE_RATE_HISTORY)
  })
})
