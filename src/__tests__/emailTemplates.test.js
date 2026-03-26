import { describe, it, expect } from 'vitest'
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
    expect(email.html).toContain('final notice')
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

  it('returns reminder_2 for 1-4 days before due', () => {
    expect(getChaseStageForDays(-1)).toBe('reminder_2')
    expect(getChaseStageForDays(-4)).toBe('reminder_2')
  })

  it('returns first_chase for 1-13 days overdue', () => {
    expect(getChaseStageForDays(1)).toBe('first_chase')
    expect(getChaseStageForDays(13)).toBe('first_chase')
  })

  it('returns second_chase for 14-29 days overdue', () => {
    expect(getChaseStageForDays(14)).toBe('second_chase')
    expect(getChaseStageForDays(29)).toBe('second_chase')
  })

  it('returns final_notice for 30+ days overdue', () => {
    expect(getChaseStageForDays(30)).toBe('final_notice')
    expect(getChaseStageForDays(60)).toBe('final_notice')
  })
})
