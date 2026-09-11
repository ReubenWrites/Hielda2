import { describe, it, expect } from 'vitest'
import { invoicePhase, lbaResponseDays, stageForDay, stageById, FORMAL_FROM_DAYS, courtFee } from '../constants'

const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

describe('invoicePhase', () => {
  it('is pre_due before the due date', () => {
    expect(invoicePhase({ status: 'pending', due_date: day(5) })).toBe('pre_due')
    expect(invoicePhase({ status: 'pending', due_date: day(0) })).toBe('pre_due')
  })

  it('is chasing in the first 30 days overdue', () => {
    expect(invoicePhase({ status: 'overdue', due_date: day(-1) })).toBe('chasing')
    expect(invoicePhase({ status: 'overdue', due_date: day(-29) })).toBe('chasing')
  })

  it('becomes formal at 30 days, when a Letter Before Action is available', () => {
    expect(invoicePhase({ status: 'overdue', due_date: day(-30) })).toBe('formal')
    expect(invoicePhase({ status: 'overdue', due_date: day(-400) })).toBe('formal')
  })

  it('stays formal while an LBA deadline is still running', () => {
    const inv = { status: 'overdue', due_date: day(-40), lba_sent_at: day(-3), lba_deadline: day(11) }
    expect(invoicePhase(inv)).toBe('formal')
  })

  it('moves to decision once the LBA deadline has passed', () => {
    const inv = { status: 'overdue', due_date: day(-60), lba_sent_at: day(-20), lba_deadline: day(-6) }
    expect(invoicePhase(inv)).toBe('decision')
  })

  it('respects parking and settlement over everything else', () => {
    expect(invoicePhase({ status: 'overdue', due_date: day(-90), parked_at: '2026-01-01' })).toBe('parked')
    expect(invoicePhase({ status: 'paid', due_date: day(-90) })).toBe('settled')
  })
})

describe('lbaResponseDays', () => {
  it('gives a company 14 days', () => {
    expect(lbaResponseDays({ client_entity: 'company' })).toBe(14)
  })
  it('gives a sole trader 30, as the Pre-Action Protocol requires', () => {
    expect(lbaResponseDays({ client_entity: 'sole_trader' })).toBe(30)
  })
  it('defaults to 14 when the debtor type is unknown', () => {
    expect(lbaResponseDays({})).toBe(14)
    expect(lbaResponseDays(null)).toBe(14)
  })
})

describe('stageById', () => {
  it('resolves enumerated stages', () => {
    expect(stageById('first_chase').dfd).toBe(1)
    expect(stageById('final_notice').phase).toBe('chasing')
  })
  it('resolves generated formal stages', () => {
    const s = stageById('formal_3')
    expect(s.phase).toBe('formal')
    expect(s.dfd).toBe(FORMAL_FROM_DAYS + 90)
    expect(s.label).toBe('Formal Reminder 3')
  })
  it('returns null for nonsense', () => {
    expect(stageById('nope')).toBeNull()
    expect(stageById(null)).toBeNull()
  })
})

describe('stageForDay and stageById agree', () => {
  it('round-trips every day from -10 to 800', () => {
    for (let d = -10; d <= 800; d++) {
      const s = stageForDay(d)
      expect(stageById(s.id)).not.toBeNull()
      expect(stageById(s.id).id).toBe(s.id)
    }
  })
})

describe('courtFee', () => {
  it('follows the gov.uk band table', () => {
    expect(courtFee(100)).toBe(35)
    expect(courtFee(300)).toBe(35)
    expect(courtFee(300.01)).toBe(50)
    expect(courtFee(500)).toBe(50)
    expect(courtFee(1000)).toBe(70)
    expect(courtFee(1500)).toBe(80)
    expect(courtFee(3000)).toBe(115)
    expect(courtFee(5000)).toBe(205)
    expect(courtFee(10000)).toBe(455)
  })
  it('is 5% of the claim between £10k and £200k, floored to the penny', () => {
    expect(courtFee(20000)).toBe(1000)
    expect(courtFee(10000.01)).toBeCloseTo(500, 2)
  })
  it('caps at £10,000 above £200k', () => {
    expect(courtFee(500000)).toBe(10000)
  })
  it('handles junk input without throwing', () => {
    expect(courtFee(0)).toBe(35)
    expect(courtFee(null)).toBe(35)
    expect(courtFee(undefined)).toBe(35)
  })
  // Ted's live invoice: £1,001.68 owed sits in the £1,000.01-£1,500 band.
  it('prices a real overdue invoice', () => {
    expect(courtFee(1001.68)).toBe(80)
  })
})
