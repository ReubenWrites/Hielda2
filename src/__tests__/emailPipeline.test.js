import { describe, it, expect } from 'vitest'
import { buildChaseEmail } from '../lib/emailTemplates'
import { friendlySubject, friendlyBody, legalSubject, legalBody } from '../lib/toneModifiers'
import { CHASE_STAGES, stageForDay } from '../constants'

// Every stage the ladder can produce must yield a real email in every tone.
// The formal_N stages past day 30 are generated rather than hand-written, and
// nothing was falling back for them: friendlySubject('formal_1') returned
// undefined, buildChaseEmail returned null, and the whole formal phase would
// have sent nothing at all. A render test can't see that.

const invoice = {
  ref: 'INV-0042', client_name: 'Acme Ltd', client_email: 'ap@acme.example.com',
  amount: 1800, amount_paid: 0, paid_before_due: 0, due_date: '2026-01-10',
  issue_date: '2025-12-11', payment_term_days: 30, description: 'Consulting',
  client_type: 'business', no_fines: false,
}
const profile = {
  full_name: 'Jo Bloggs', business_name: 'Bloggs Ltd',
  bank_name: 'Barclays', sort_code: '20-00-00', account_number: '12345678',
  account_name: 'Bloggs Ltd',
}

// The enumerated ladder plus a good spread of generated formal stages.
const everyStage = [
  ...CHASE_STAGES.map((s) => s.id),
  'formal_1', 'formal_2', 'formal_7', 'formal_24', 'formal_71',
]

describe('chase emails build for every stage in every tone', () => {
  for (const stage of everyStage) {
    for (const tone of ['firm', 'friendly', 'legal']) {
      it(`${stage} / ${tone}`, () => {
        const email = buildChaseEmail(invoice, profile, stage, tone)
        expect(email).not.toBeNull()
        expect(email.subject).toBeTruthy()
        expect(email.subject).toContain('INV-0042')
        expect(email.html).toContain('Acme Ltd')
        // Bank details must survive into every one: an email the client
        // can't pay from is worse than no email.
        expect(email.html).toContain('20-00-00')
      })
    }
  }
})

describe('tone modifiers cover the generated formal stages', () => {
  const ctx = {
    invoice, profile, dl: 90, total: 1950, interest: 50, pen: 100,
    fromName: 'Bloggs Ltd', poRef: '',
    interestTable: '<table></table>', totalBlock: '<div></div>',
    lineBlock: '', payBlock: '<div>bank</div>',
  }
  for (const stage of ['formal_1', 'formal_9', 'formal_60']) {
    it(`friendly and legal both resolve ${stage}`, () => {
      expect(friendlySubject(stage, ctx)).toBeTruthy()
      expect(friendlyBody(stage, ctx)).toBeTruthy()
      expect(legalSubject(stage, ctx)).toBeTruthy()
      expect(legalBody(stage, ctx)).toBeTruthy()
    })
  }
  it('still returns nothing for a stage that was never real', () => {
    expect(friendlySubject('not_a_stage', ctx)).toBeUndefined()
  })
})

describe('the ladder never produces a stage the emailer cannot build', () => {
  // Every stage the ladder can reach in six years, deduplicated: building
  // 2,190 full HTML emails is needlessly slow, and only distinct stages can
  // fail.
  it('holds for every distinct stage from the due date out to six years', () => {
    const seen = new Set()
    for (let day = 0; day <= 2190; day += 1) seen.add(stageForDay(day).id)
    expect(seen.size).toBeGreaterThan(70)
    for (const stage of seen) {
      const email = buildChaseEmail(invoice, profile, stage, 'firm')
      if (!email) throw new Error(`stage "${stage}" produced no email`)
    }
  })
})
