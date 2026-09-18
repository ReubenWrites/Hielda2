import { describe, it, expect } from 'vitest'
import { shouldEmailClientOnCreate } from '../lib/sendDecision'

// Live incident, 18 Sep 2026: the user ticked "I'll send the PDF to the
// client myself" and Hielda emailed the client anyway, because the send
// was gated on two other controls that both defaulted to "Hielda sends".
// The confirmation screen then said "✓ Introduction email sent". This is
// the single worst thing the product can do, so the rule is exhaustive.

describe('shouldEmailClientOnCreate', () => {
  it('the incident: PDF-myself ticked, the other two left at defaults → no email', () => {
    expect(shouldEmailClientOnCreate({ sendIntro: true, introMethod: 'hielda', meth: 'download' })).toBe(false)
  })

  it('sends only when every control says Hielda sends', () => {
    expect(shouldEmailClientOnCreate({ sendIntro: true, introMethod: 'hielda', meth: 'portal' })).toBe(true)
  })

  it('any single "I\'ll do it myself" wins, whichever control it comes from', () => {
    const combos = []
    for (const sendIntro of [true, false])
      for (const introMethod of ['hielda', 'self'])
        for (const meth of ['portal', 'download'])
          combos.push({ sendIntro, introMethod, meth })
    expect(combos).toHaveLength(8)
    for (const c of combos) {
      const expected = c.sendIntro && c.introMethod === 'hielda' && c.meth === 'portal'
      expect(shouldEmailClientOnCreate(c), JSON.stringify(c)).toBe(expected)
    }
  })

  it('treats anything unexpected as "do not send"', () => {
    expect(shouldEmailClientOnCreate({ sendIntro: true, introMethod: undefined, meth: 'portal' })).toBe(false)
    expect(shouldEmailClientOnCreate({ sendIntro: true, introMethod: 'hielda', meth: undefined })).toBe(true)
    expect(shouldEmailClientOnCreate({})).toBe(false)
  })
})
