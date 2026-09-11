import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LetterBeforeAction from '../components/LetterBeforeAction'

vi.mock('../supabase', () => {
  const chain = {
    select: () => chain, eq: () => chain, order: () => Promise.resolve({ data: [] }),
  }
  return { supabase: { from: () => chain, auth: { getSession: () => Promise.resolve({ data: {} }) } } }
})
vi.mock('../posthog', () => ({ trackEvent: vi.fn() }))

const profile = {
  full_name: 'Reuben Williams', business_name: 'Reuben Enterprises',
  address: '301 Circuit Mansions\nPrime Point\n39 West Parkside\nSE10 0QD',
  email: 'reubenwilliams@gmx.com', account_name: 'Mr R Williams',
  sort_code: '200574', account_number: '40948616',
}

// Shaped like the live invoice: a description that is every line item run
// together, which used to be dumped inline and swamped the letter.
const invoice = {
  id: 'inv-7', ref: 'INV-0007-Week-4', client_name: 'MovieSweep',
  client_email: 'ted@example.com', amount: 1561.02, amount_paid: 649.23,
  paid_before_due: 0, status: 'overdue', due_date: '2026-08-02',
  issue_date: '2026-07-03', payment_term_days: 30, client_type: 'business',
  no_fines: false, chase_stage: 'final_notice',
  description: 'Week 4, Kit hire, 4 days @ £100 / day, Replacing bags, diffusor, and stand which have been lost / damaged/ worn out on the shoot, 29th - Travel, 30th - Travel, 1st July - Travel, 2nd July - Travel, 2nd July - Uber',
}

// The page holds the letter back until the payment ledger has loaded, so
// that it never shows a provisional interest figure. Wait for it.
const letterText = async (inv = invoice) => {
  render(
    <MemoryRouter>
      <LetterBeforeAction inv={inv} profile={profile} onUpdate={() => {}} />
    </MemoryRouter>
  )
  await waitFor(() => expect(screen.queryByText(/LETTER BEFORE ACTION/)).not.toBeNull())
  return screen.getByText(/LETTER BEFORE ACTION/).textContent
}

describe('the letter reads like a letter, not an invoice dump', () => {
  it('keeps the long itemised description out of the prose', async () => {
    const text = await letterText()
    expect(text).not.toContain('Replacing bags, diffusor')
    expect(text).not.toContain('2nd July - Uber')
  })

  it('states the invoice in a labelled block instead', async () => {
    const text = await letterText()
    expect(text).toContain('THE INVOICE')
    expect(text).toContain('INV-0007-Week-4')
    expect(text).toContain('3 Jul 2026')      // issued
    expect(text).toContain('2 Aug 2026')      // payment due
    expect(text).toContain('£1,561.02')       // amount
    expect(text).toContain('Week 4')          // headline only
  })

  it('tells the client a copy of the invoice is enclosed', async () => {
    expect(await letterText()).toMatch(/copy is enclosed/i)
  })

  it('truncates an over-long headline rather than running on', async () => {
    const text = await letterText({
      ...invoice,
      description: 'An extremely long first line item that simply keeps going well past any sensible width for a letter',
    })
    const forLine = text.split('\n').find((l) => l.trim().startsWith('For:'))
    expect(forLine.length).toBeLessThan(80)
    expect(forLine).toContain('...')
  })

  it('prefers the first line item when there are line items', async () => {
    const text = await letterText({
      ...invoice,
      line_items: [{ description: 'Week 4 production', amount: 1000 }, { description: 'Kit hire', amount: 400 }],
    })
    expect(text).toContain('Week 4 production')
    expect(text).not.toContain('Kit hire')
  })

  it('omits the headline line entirely when there is no description', async () => {
    const text = await letterText({ ...invoice, description: null, line_items: null })
    expect(text).not.toMatch(/^\s*For:/m)
    expect(text).toContain('THE INVOICE')
  })

  it('still carries the sum claimed, the deadline and the bank details', async () => {
    const text = await letterText()
    expect(text).toContain('THE SUM CLAIMED')
    expect(text).toContain('TOTAL NOW DUE')
    expect(text).toContain('40948616')
    expect(text).toMatch(/within 14 days/)
  })
})
