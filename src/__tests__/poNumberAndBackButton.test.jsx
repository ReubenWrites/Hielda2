import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link, useSearchParams } from 'react-router-dom'
import Create from '../components/Create'

// Two bug reports from a real user (9 Nov 2026), walked the way the user
// walks them rather than reasoned about:
//
// 1. "The PO number doesn't always appear on the invoice, even when filled
//    in, especially on multi-line invoices." The PO lives in a collapsed
//    "Invoice details" section, the review step never showed it, and the
//    user had no way to tell it had taken.
// 2. "Pressing Back at the top left on the review screen deletes the
//    draft." The header Back went straight to the dashboard; the work
//    survived only as an invisible localStorage slot behind a banner.
//
// The harness records every insert so the test can read exactly what
// would have hit the database.

const inserted = { invoices: [], invoice_drafts: [] }
let savedDraft = null

vi.mock('../supabase', () => ({
  supabase: {
    from: (table) => ({
      insert: (row) => {
        inserted[table]?.push(row)
        if (table === 'invoice_drafts') savedDraft = { id: 'draft-1', payload: row.payload }
        const id = table === 'invoice_drafts' ? 'draft-1' : 'new-inv-1'
        return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) }
      },
      update: (row) => ({
        eq: async () => {
          if (table === 'invoice_drafts' && savedDraft) savedDraft = { ...savedDraft, payload: row.payload }
          return { error: null }
        },
      }),
      delete: () => ({ eq: () => ({ then: (r) => r({}) }) }),
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: table === 'invoice_drafts' ? savedDraft : null }) }),
          order: () => ({ limit: async () => ({ data: [] }) }),
        }),
      }),
    }),
    rpc: async () => ({ data: null, error: null }),
    auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
  },
}))
vi.mock('../posthog', () => ({ trackEvent: vi.fn() }))

const profile = {
  id: 'u1', email: 'me@example.com', full_name: 'Louise Lee', business_name: 'Lee Studio',
  sort_code: '20-05-74', account_number: '40948616', account_name: 'L Lee',
  invoice_prefix: 'INV', next_invoice_number: 30,
}

// A tiny stand-in for the dashboard: shows the saved draft like the real
// one does (a card that opens /create?draft=<id>) plus a New invoice link.
function FakeDashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Link to="/create">New invoice</Link>
      {savedDraft && <Link to={`/create?draft=${savedDraft.id}`}>Resume draft</Link>}
    </div>
  )
}
function CreateRoute() {
  // Create reads ?draft= itself; this wrapper only exists so the route re-mounts.
  useSearchParams()
  return <Create profile={profile} userId="u1" onCreated={() => {}} isMobile={false} invs={[]} />
}

const renderApp = () => render(
  <MemoryRouter initialEntries={['/create']}>
    <Routes>
      <Route path="/create" element={<CreateRoute />} />
      <Route path="/dashboard" element={<FakeDashboard />} />
    </Routes>
  </MemoryRouter>,
)

const PO = 'PO-20157835'
const LINES = [
  ['Studio day — 3 Oct', '450'],
  ['Edit and grade', '600'],
  ['Travel', '85.50'],
]

const fillMultiLineInvoiceWithPo = async () => {
  fireEvent.change(screen.getByLabelText('Company Name'), { target: { value: 'Kaleidoscope Ltd' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ap@kaleidoscope.example.com' } })
  fireEvent.click(screen.getByRole('button', { name: '+ Add line' }))
  fireEvent.click(screen.getByRole('button', { name: '+ Add line' }))
  const descs = screen.getAllByPlaceholderText('e.g. Video production')
  const amts = screen.getAllByPlaceholderText('0.00')
  expect(descs).toHaveLength(3)
  LINES.forEach(([d, a], i) => {
    fireEvent.change(descs[i], { target: { value: d } })
    fireEvent.change(amts[i], { target: { value: a } })
  })
  // The PO field is inside the collapsed "Invoice details" section.
  fireEvent.click(screen.getByRole('button', { name: /Invoice details/ }))
  fireEvent.change(screen.getByLabelText(/Client reference \/ PO number/), { target: { value: PO } })
}

const goToReview = async () => {
  const review = screen.getAllByRole('button', { name: /Review/ }).find((b) => !b.disabled)
  expect(review, 'Review button enabled').toBeTruthy()
  fireEvent.click(review)
  await screen.findByLabelText(/I'll send the PDF to/)
}

const headerBack = () => screen.getAllByRole('button', { name: /← Back/ })[0]

const createInvoice = async () => {
  const btn = screen.getAllByRole('button').find((b) => /Create & Download|Send to /.test(b.textContent))
  fireEvent.click(btn)
  await screen.findByText(/Invoice Created/)
}

beforeEach(() => {
  localStorage.clear()
  inserted.invoices.length = 0
  inserted.invoice_drafts.length = 0
  savedDraft = null
  global.fetch = vi.fn(async () => ({ ok: true, text: async () => '{}', json: async () => ({}) }))
})

describe('PO number on a multi-line invoice', () => {
  it('is visible on the review screen and lands in the saved invoice', async () => {
    renderApp()
    await fillMultiLineInvoiceWithPo()
    // The collapsed section's summary line confirms the PO took, so the
    // user doesn't have to reopen it to check.
    expect(screen.getByText(new RegExp(PO))).toBeTruthy()
    await goToReview()
    // Review screen shows it in the invoice details block.
    const review = screen.getByText(/Issue:/).parentElement
    expect(within(review).getByText(new RegExp(PO))).toBeTruthy()
    await createInvoice()
    expect(inserted.invoices).toHaveLength(1)
    expect(inserted.invoices[0].client_ref).toBe(PO)
    expect(inserted.invoices[0].line_items).toHaveLength(3)
  })
})

describe('header Back on the review screen', () => {
  it('saves the work as a dashboard draft instead of losing it, and the draft resumes with the PO and every line', async () => {
    renderApp()
    await fillMultiLineInvoiceWithPo()
    await goToReview()

    fireEvent.click(headerBack())
    await screen.findByText('Dashboard')

    // The draft was saved to the server (so it shows on the real dashboard).
    expect(inserted.invoice_drafts, 'server draft saved on Back').toHaveLength(1)
    const payload = inserted.invoice_drafts[0].payload
    expect(payload.clientRef).toBe(PO)
    expect(payload.lineItems.filter((li) => li.description)).toHaveLength(3)
    expect(payload.cn).toBe('Kaleidoscope Ltd')

    // Resume it from the dashboard: everything is back, including the PO.
    fireEvent.click(screen.getByText('Resume draft'))
    await screen.findByText('Create Invoice')
    await waitFor(() => expect(screen.getByLabelText('Company Name').value).toBe('Kaleidoscope Ltd'))
    const descs = screen.getAllByPlaceholderText('e.g. Video production')
    expect(descs.map((d) => d.value)).toEqual(LINES.map(([d]) => d))
    fireEvent.click(screen.getByRole('button', { name: /Invoice details/ }))
    expect(screen.getByLabelText(/Client reference \/ PO number/).value).toBe(PO)

    // And creating it from the resumed draft keeps the PO.
    await goToReview()
    await createInvoice()
    expect(inserted.invoices[0].client_ref).toBe(PO)
    expect(inserted.invoices[0].line_items).toHaveLength(3)
  })

  it('with nothing typed, Back just goes to the dashboard and saves no draft', async () => {
    renderApp()
    fireEvent.click(headerBack())
    await screen.findByText('Dashboard')
    expect(inserted.invoice_drafts).toHaveLength(0)
  })

  it('a resumed draft that is edited and then backed out of updates the same draft, not a stale copy', async () => {
    renderApp()
    await fillMultiLineInvoiceWithPo()
    await goToReview()
    fireEvent.click(headerBack())
    await screen.findByText('Dashboard')
    fireEvent.click(screen.getByText('Resume draft'))
    await screen.findByText('Create Invoice')
    await waitFor(() => expect(screen.getByLabelText('Company Name').value).toBe('Kaleidoscope Ltd'))

    fireEvent.click(screen.getByRole('button', { name: '+ Add line' }))
    const descs = screen.getAllByPlaceholderText('e.g. Video production')
    const amts = screen.getAllByPlaceholderText('0.00')
    fireEvent.change(descs[3], { target: { value: 'Extra retouching' } })
    fireEvent.change(amts[3], { target: { value: '120' } })
    await goToReview()
    fireEvent.click(headerBack())
    await screen.findByText('Dashboard')

    // Still one draft row; its payload now has four lines.
    expect(inserted.invoice_drafts).toHaveLength(1)
    expect(savedDraft.payload.lineItems.filter((li) => li.description)).toHaveLength(4)
    expect(savedDraft.payload.clientRef).toBe(PO)
  })
})
