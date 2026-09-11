import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Detail from '../components/Detail'

// Detail talks to Supabase and PostHog on mount; neither is needed to prove
// the timeline renders.
vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: [] }), eq: () => Promise.resolve({ data: [] }) }),
        order: () => Promise.resolve({ data: [] }),
      }),
    }),
  },
}))
vi.mock('../posthog', () => ({ trackEvent: vi.fn() }))

const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const profile = {
  full_name: 'Reuben Williams', business_name: 'Reuben Enterprises',
  account_name: 'R Williams', sort_code: '20-05-74', account_number: '40948616',
}

const overdue = {
  id: 'test-1', ref: 'INV-0007-Week-4', client_name: 'MovieSweep',
  client_email: 'client@example.com', amount: 1561.02, amount_paid: 649.23,
  paid_before_due: 0, status: 'overdue', due_date: daysAgo(40),
  issue_date: daysAgo(70), payment_term_days: 30, chase_stage: 'final_notice',
  description: 'Week 4', client_type: 'business', no_fines: false,
}

const renderDetail = (inv) =>
  render(
    <MemoryRouter>
      <Detail inv={inv} profile={profile} onUpdate={() => {}} isMobile={false} />
    </MemoryRouter>
  )

describe('invoice detail renders across the ladder', () => {
  beforeEach(() => vi.clearAllMocks())

  // Regression: the timeline kept its own hard-coded copy of the old chase
  // ladder. When the ladder changed, the groups listing removed stages
  // resolved to nothing and groupStages[0].dfd threw, so every overdue
  // invoice page died with an error screen.
  it('renders an overdue invoice with the chase timeline', () => {
    renderDetail(overdue)
    expect(screen.getByText('Chase Timeline')).toBeTruthy()
    expect(screen.getAllByText(/INV-0007-Week-4/).length).toBeGreaterThan(0)
  })

  // The timeline's own copy mentions the letter, so target the button.
  const lbaButton = () =>
    screen.queryAllByRole('button').find((b) => /Letter Before Action/.test(b.textContent))

  it('offers the Letter Before Action past 30 days overdue', () => {
    renderDetail(overdue)
    expect(lbaButton()).toBeTruthy()
  })

  it('does not offer it before 30 days', () => {
    renderDetail({ ...overdue, due_date: daysAgo(10), chase_stage: 'second_chase' })
    expect(lbaButton()).toBeFalsy()
  })

  it('does not offer it once one has been sent', () => {
    renderDetail({ ...overdue, lba_sent_at: daysAgo(2), lba_deadline: daysAgo(-12) })
    expect(lbaButton()).toBeFalsy()
  })

  it('renders a settled invoice', () => {
    renderDetail({ ...overdue, status: 'paid', paid_date: daysAgo(1), amount_paid: 1561.02 })
    expect(screen.getAllByText(/INV-0007-Week-4/).length).toBeGreaterThan(0)
  })

  it('renders an invoice sitting deep in the formal phase', () => {
    renderDetail({ ...overdue, due_date: daysAgo(200), chase_stage: 'formal_5' })
    expect(screen.getByText('Chase Timeline')).toBeTruthy()
  })
})
