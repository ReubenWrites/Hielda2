import { describe, it, expect } from 'vitest'
import { buildChaseEmail } from '../lib/emailTemplates'
import { firmSubject, friendlySubject, legalSubject, plainSubject } from '../../api/_toneModifiers.js'

// Found live on 21 Sep 2026: a client who had paid £100 of a £300 invoice
// was sent "invoice INV-0001 for £300.00 ... settled at the original
// amount of £300.00". Every sentence and subject line that names an amount
// must name the BALANCE. The line-items table may still show the original
// total, but then it must also show what was paid and what's left.

const profile = { full_name: 'Jo', business_name: 'Jo Ltd', sort_code: '20-00-00', account_number: '12345678', account_name: 'Jo Ltd' }
const inv = {
  ref: 'INV-0001', client_name: 'Acme', client_email: 'ap@acme.example',
  amount: 300, amount_paid: 100, paid_before_due: 100,
  issue_date: '2026-09-21', due_date: '2026-10-21', payment_term_days: 30,
  client_type: 'business', no_fines: false,
  line_items: [{ description: 'Design work', amount: 300, vatRate: '0' }],
}
const preDue = ['reminder_1', 'reminder_2', 'final_warning']

describe('a part-paid invoice is chased for the balance', () => {
  for (const tone of ['firm', 'friendly', 'legal']) {
    for (const stage of preDue) {
      it(`preview / ${tone} / ${stage}`, () => {
        const e = buildChaseEmail(inv, profile, stage, tone)
        expect(e.subject + e.html).toContain('£200.00')
        expect(e.html).not.toMatch(/for <strong>£300\.00/)
        expect(e.html).not.toMatch(/original amount of <strong>£300\.00/)
        // The table still reconciles: total, paid, balance.
        expect(e.html).toContain('Paid so far')
        expect(e.html).toContain('Balance')
      })
    }
  }

  it('server subject lines quote the balance in every tone', () => {
    const ctx = { invoice: inv, total: 200, dl: 0, poRef: '' }
    for (const fn of [firmSubject, friendlySubject, legalSubject, plainSubject]) {
      const s = fn('reminder_1', ctx)
      expect(s).toContain('£200.00')
      expect(s).not.toContain('£300.00')
    }
  })

  it('nothing changes for an invoice with no payments', () => {
    const e = buildChaseEmail({ ...inv, amount_paid: 0, paid_before_due: 0 }, profile, 'reminder_1', 'firm')
    expect(e.subject).toContain('£300.00')
    expect(e.html).not.toContain('Paid so far')
  })
})
