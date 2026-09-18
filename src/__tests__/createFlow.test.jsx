import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Create from '../components/Create'

// Drives the real creation form the way a person does: fill it in, tick
// "I'll send the PDF myself", create the invoice. The one assertion that
// matters is that no request is ever made to the intro-email endpoint.
//
// The mirror test, where the box is left unticked, proves the harness can
// actually see a send — without it, a broken harness would pass silently.

vi.mock('../supabase', () => {
  const insertChain = { select: () => insertChain, single: async () => ({ data: { id: 'new-inv-1' }, error: null }) }
  const deleteChain = { eq: () => ({ then: (r) => r({}) }) }
  return {
    supabase: {
      from: (table) => ({
        insert: () => insertChain,
        delete: () => deleteChain,
        select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }),
      rpc: async () => ({ data: null, error: null }),
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    },
  }
})
vi.mock('../posthog', () => ({ trackEvent: vi.fn() }))

const profile = {
  id: 'u1', email: 'me@example.com', full_name: 'Reuben Williams',
  business_name: 'Reuben Enterprises', sort_code: '20-05-74', account_number: '40948616',
  account_name: 'R Williams', invoice_prefix: 'INV', next_invoice_number: 11,
}

const fillAndReview = async () => {
  fireEvent.change(screen.getByLabelText('Company Name'), { target: { value: 'Matthew Osborn Media Ltd' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'matthew@example.com' } })
  fireEvent.change(screen.getByPlaceholderText('e.g. Video production'), { target: { value: 'Assistance with L&Q testimonial shoot' } })
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '150' } })
  const review = screen.getAllByRole('button', { name: /Review/ }).find((b) => !b.disabled)
  expect(review, 'Review button should be enabled once the form is valid').toBeTruthy()
  fireEvent.click(review)
  await screen.findByLabelText(/I'll send the PDF to/)
}

// The button reads "Create & Download" when the user sends it themselves
// and "Send to <client>" when Hielda sends — match both.
const createInvoice = async () => {
  const btn = screen.getAllByRole('button').find((b) => /Create & Download|Send to /.test(b.textContent))
  expect(btn, 'create button').toBeTruthy()
  fireEvent.click(btn)
  await screen.findByText(/Invoice Created/)
}

const introCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => String(url).includes('send-intro-email'))

describe('creating an invoice never emails a client the user said they would contact themselves', () => {
  let fetchMock
  beforeEach(() => {
    localStorage.clear()
    fetchMock = vi.fn(async () => ({ ok: true, text: async () => '{}', json: async () => ({}) }))
    global.fetch = fetchMock
    render(
      <MemoryRouter>
        <Create profile={profile} userId="u1" onCreated={() => {}} isMobile={false} invs={[]} />
      </MemoryRouter>
    )
  })

  it('the incident: "I\'ll send the PDF myself" ticked → no intro email request', async () => {
    await fillAndReview()
    fireEvent.click(screen.getByLabelText(/I'll send the PDF to/))
    await createInvoice()
    expect(introCalls(fetchMock)).toHaveLength(0)
    // And the confirmation screen must not claim otherwise.
    expect(screen.queryByText(/Introduction email sent/)).toBeNull()
  })

  it('mirror: left unticked, the intro email request is made (proves the harness sees sends)', async () => {
    await fillAndReview()
    await createInvoice()
    await waitFor(() => expect(introCalls(fetchMock)).toHaveLength(1))
  })

  // The switch is on step 1 and the checkbox on step 2, which is exactly why
  // they drifted apart. A person who ticks the box and goes back must see
  // the switch reflect it.
  it('ticking the box turns the "Email the invoice" switch off, visibly', async () => {
    const sw = () => screen.getByRole('switch', { name: 'Email the invoice to your client' })
    expect(sw().getAttribute('aria-checked')).toBe('true')
    await fillAndReview()
    fireEvent.click(screen.getByLabelText(/I'll send the PDF to/))
    // Two "← Back" buttons: the page header's goes to the dashboard (and
    // unmounts the form); the step footer's goes to step 1. We want the latter.
    fireEvent.click(screen.getAllByRole('button', { name: /← Back/ }).at(-1))
    await waitFor(() => expect(sw().getAttribute('aria-checked')).toBe('false'))
    expect(screen.getByText(/you've chosen to send the PDF yourself/)).toBeTruthy()
  })
})
