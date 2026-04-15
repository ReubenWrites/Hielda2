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
    expect(email.html).toContain('penalty')
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

  it('returns second_chase for days 6-8', () => {
    expect(getChaseStageForDays(6)).toBe('second_chase')
    expect(getChaseStageForDays(8)).toBe('second_chase')
  })

  it('returns third_chase for days 9-10', () => {
    expect(getChaseStageForDays(9)).toBe('third_chase')
    expect(getChaseStageForDays(10)).toBe('third_chase')
  })

  it('returns chase_4 through chase_11 for days 11-25', () => {
    expect(getChaseStageForDays(11)).toBe('chase_4')
    expect(getChaseStageForDays(13)).toBe('chase_5')
    expect(getChaseStageForDays(15)).toBe('chase_6')
    expect(getChaseStageForDays(17)).toBe('chase_7')
    expect(getChaseStageForDays(19)).toBe('chase_8')
    expect(getChaseStageForDays(21)).toBe('chase_9')
    expect(getChaseStageForDays(23)).toBe('chase_10')
    expect(getChaseStageForDays(25)).toBe('chase_11')
  })

  it('returns escalation stages for days 26-29', () => {
    expect(getChaseStageForDays(26)).toBe('escalation_1')
    expect(getChaseStageForDays(27)).toBe('escalation_2')
    expect(getChaseStageForDays(28)).toBe('escalation_3')
    expect(getChaseStageForDays(29)).toBe('escalation_4')
  })

  it('returns final_notice for 30 days overdue', () => {
    expect(getChaseStageForDays(30)).toBe('final_notice')
  })

  it('returns recovery stages for 31-45 days overdue', () => {
    expect(getChaseStageForDays(31)).toBe('recovery_1')
    expect(getChaseStageForDays(38)).toBe('recovery_5')
    expect(getChaseStageForDays(45)).toBe('recovery_final')
    expect(getChaseStageForDays(60)).toBe('recovery_final')
  })
})
