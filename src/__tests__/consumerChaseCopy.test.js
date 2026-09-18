import { describe, it, expect } from 'vitest'
import { buildChaseEmail } from '../lib/emailTemplates'
import { CHASE_STAGES } from '../constants'

// The Late Payment of Commercial Debts (Interest) Act 1998 applies to
// business-to-business debts only. A consumer, or a client whose fines the
// user has waived, must never be told statutory interest and a fixed
// recovery fee are being applied. Every toned template hard-codes that
// language, so those invoices get the plain letter instead — in every tone,
// at every stage.

const profile = { full_name: 'Jo', business_name: 'Jo Ltd', sort_code: '20-00-00', account_number: '12345678', account_name: 'Jo Ltd' }
const base = {
  ref: 'INV-0021', client_name: 'Sam Smith', client_email: 'sam@example.com',
  amount: 300, amount_paid: 0, paid_before_due: 0, due_date: '2026-08-01',
  issue_date: '2026-07-01', payment_term_days: 30,
}
const stages = [...CHASE_STAGES.map((s) => s.id), 'formal_1', 'formal_4']
// Claim language only. The marketing footer on every email says Hielda
// "adds the statutory late fees you're entitled to" — a line about the
// service, addressed to the reader, not a charge against them — so a bare
// "statutory" would be a false positive. These phrases are the ones the
// toned templates use when they are actually asserting a claim.
const FORBIDDEN = /Late Payment of Commercial Debts|statutory (interest|charges|rules|right|demand|fees have|fees will|penalt)|fixed debt recovery|recovery cost|penalt/i

describe('no statutory language to consumers or fines-off invoices', () => {
  for (const tone of ['firm', 'friendly', 'legal']) {
    for (const stage of stages) {
      it(`consumer / ${tone} / ${stage}`, () => {
        const e = buildChaseEmail({ ...base, client_type: 'consumer', no_fines: false }, profile, stage, tone)
        expect(e).not.toBeNull()
        expect(e.subject).not.toMatch(FORBIDDEN)
        expect(e.html).not.toMatch(FORBIDDEN)
        // Still an actual chase with the bank details in it.
        expect(e.html).toContain('20-00-00')
        expect(e.html).toContain('INV-0021')
      })
      it(`fines waived / ${tone} / ${stage}`, () => {
        const e = buildChaseEmail({ ...base, client_type: 'business', no_fines: true }, profile, stage, tone)
        expect(e.subject).not.toMatch(FORBIDDEN)
        expect(e.html).not.toMatch(FORBIDDEN)
      })
    }
  }

  it('a business client with fines on still gets the Act cited', () => {
    const e = buildChaseEmail({ ...base, client_type: 'business', no_fines: false }, profile, 'first_chase', 'firm')
    expect(e.html).toMatch(/Late Payment of Commercial Debts/)
  })

  it('a consumer is never charged interest, whatever no_fines says', () => {
    const e = buildChaseEmail({ ...base, client_type: 'consumer', no_fines: false }, profile, 'first_chase', 'firm')
    expect(e.html).toContain('£300.00')
    expect(e.html).not.toMatch(/£3[4-9]\d\.\d\d/)   // no £340-ish "with fee" figure anywhere
  })
})
