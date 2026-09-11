import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildChaseEmail, getChaseStageForDays } from '../lib/emailTemplates'

const mockInvoice = {
  ref: 'INV-TEST01',
  client_name: 'Acme Corp',
  client_email: 'accounts@acme.com',
  amount: 5000,
  due_date: '2026-03-01',
  issue_date: '2026-02-01',
  payment_term_days: 30,
}

const mockProfile = {
  full_name: 'Jane Smith',
  business_name: 'Smith Design Ltd',
  bank_name: 'Barclays',
  sort_code: '12-34-56',
  account_number: '12345678',
}

describe('buildChaseEmail', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('generates reminder_1 email', () => {
    const email = buildChaseEmail(mockInvoice, mockProfile, 'reminder_1')
    expect(email).not.toBeNull()
    expect(email.subject).toContain('INV-TEST01')
    expect(email.subject).toContain('reminder')
    expect(email.to).toBe('accounts@acme.com')
    expect(email.html).toContain('Acme Corp')
    expect(email.html).toContain('Smith Design Ltd')
    expect(email.html).toContain('12-34-56')
  })

  it('generates final_notice email with interest', () => {
    const email = buildChaseEmail(mockInvoice, mockProfile, 'final_notice')
    expect(email).not.toBeNull()
    expect(email.subject).toContain('FINAL NOTICE')
    expect(email.html).toContain('FINAL NOTICE')
    expect(email.html).toContain('Hielda')
  })

  it('generates second_chase email with interest breakdown', () => {
    const email = buildChaseEmail(mockInvoice, mockProfile, 'second_chase')
    expect(email).not.toBeNull()
    expect(email.subject).toContain('OVERDUE')
    // Statutory wording uses "debt recovery cost" — the Act calls the
    // £40/£70/£100 a "fixed sum (debt recovery cost)", not a "penalty".
    expect(email.html.toLowerCase()).toContain('debt recovery cost')
  })

  it('returns null for unknown stage', () => {
    const email = buildChaseEmail(mockInvoice, mockProfile, 'nonexistent_stage')
    expect(email).toBeNull()
  })

  it('includes payment details in all templates', () => {
    const stages = ['reminder_1', 'reminder_2', 'first_chase', 'second_chase', 'final_notice']
    for (const stage of stages) {
      const email = buildChaseEmail(mockInvoice, mockProfile, stage)
      expect(email.html).toContain('Payment Details')
      expect(email.html).toContain('Barclays')
    }
  })
})

describe('getChaseStageForDays', () => {
  it('returns reminder_1 for 5+ days before due', () => {
    expect(getChaseStageForDays(-5)).toBe('reminder_1')
    expect(getChaseStageForDays(-10)).toBe('reminder_1')
  })

  it('returns reminder_2 for 1 day before due and reminder_1 for further out', () => {
    expect(getChaseStageForDays(-1)).toBe('reminder_2')
    expect(getChaseStageForDays(-4)).toBe('reminder_1')
  })

  it('returns final_warning on due date', () => {
    expect(getChaseStageForDays(0)).toBe('final_warning')
  })

  it('returns first_chase for days 1-5', () => {
    expect(getChaseStageForDays(1)).toBe('first_chase')
    expect(getChaseStageForDays(5)).toBe('first_chase')
  })

  it('returns second_chase from day 7', () => {
    expect(getChaseStageForDays(7)).toBe('second_chase')
    expect(getChaseStageForDays(13)).toBe('second_chase')
  })

  it('returns third_chase from day 14', () => {
    expect(getChaseStageForDays(14)).toBe('third_chase')
    expect(getChaseStageForDays(20)).toBe('third_chase')
  })

  it('returns chase_4 from day 21', () => {
    expect(getChaseStageForDays(21)).toBe('chase_4')
    expect(getChaseStageForDays(29)).toBe('chase_4')
  })

  it('returns final_notice from day 30 — the last informal chase', () => {
    expect(getChaseStageForDays(30)).toBe('final_notice')
    // Days 31-59 stay on final_notice: it has already been sent, so nothing
    // new fires until the first monthly formal reminder.
    expect(getChaseStageForDays(45)).toBe('final_notice')
    expect(getChaseStageForDays(59)).toBe('final_notice')
  })

  // Regression: the ladder used to end at day 45 and the invoice then went
  // permanently silent. Formal reminders are generated monthly instead, so
  // there is always a next step.
  it('generates monthly formal reminders past day 30, indefinitely', () => {
    expect(getChaseStageForDays(60)).toBe('formal_1')
    expect(getChaseStageForDays(89)).toBe('formal_1')
    expect(getChaseStageForDays(90)).toBe('formal_2')
    expect(getChaseStageForDays(120)).toBe('formal_3')
    expect(getChaseStageForDays(365)).toBe('formal_11')
    // Still producing a stage years later, within the six-year claim window.
    expect(getChaseStageForDays(1800)).toBe('formal_59')
  })
})
