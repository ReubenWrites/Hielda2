import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// User pathway: a brand-new account (profile row exists, onboarding not
// done) opens the app. Since 2026-10-20 they must land in the dashboard
// with a "finish setup" banner, and the banner must take them to the
// business-details step at /setup, with no welcome screen in between.
// Before that date the app showed the three-step onboarding as a wall.
//
// Simulated with a mocked Supabase session; the live walk can't be done
// without creating a real account on production.

const NEW_USER = { id: 'u-new', email: 'new@example.com', user_metadata: { full_name: 'New Person' } }
const PROFILE = { id: 'u-new', email: 'new@example.com', full_name: 'New Person', business_name: null, onboarding_complete: false }
const SUB = { user_id: 'u-new', status: 'trialing', trial_end: new Date(Date.now() + 40 * 86400000).toISOString() }

vi.mock('../supabase', () => {
  const table = (rows) => {
    const chain = {
      select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, in: () => chain, is: () => chain,
      single: async () => ({ data: rows[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve) => resolve({ data: rows, error: null }),
    }
    return chain
  }
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { user: NEW_USER, access_token: 't' } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({}),
      },
      from: (name) => {
        if (name === 'profiles') return table([PROFILE])
        if (name === 'subscriptions') return table([SUB])
        return table([])
      },
      channel: () => ({ on() { return this }, subscribe() { return this } }),
      removeChannel() {},
    },
  }
})
vi.mock('../posthog', () => ({ initPostHog() {}, identifyUser() {}, resetUser() {}, trackPageView() {}, trackEvent() {} }))

describe('new account lands in the dashboard, not on an onboarding wall', () => {
  it('shows the finish-setup banner on /dashboard and the banner opens the business-details step', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    const { ConfirmProvider, ToastProvider } = await import('../components/ui.jsx')
    const App = (await import('../App')).default
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ConfirmProvider><ToastProvider><App /></ToastProvider></ConfirmProvider>
      </MemoryRouter>,
    )

    // The dashboard, with the banner, and NOT the old welcome wall.
    const banner = await screen.findByText(/Finish setup/i, {}, { timeout: 8000 })
    // The old wall's welcome copy and its "Get Started" button must not be there.
    expect(screen.queryByText(/calculates the interest and penalties you're legally owed/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Get Started$/i })).toBeNull()
    expect((await screen.findAllByText(/first invoice/i, {}, { timeout: 8000 })).length).toBeGreaterThan(0)

    // Clicking the banner goes straight to "Your Business" (step 1), not "Welcome".
    fireEvent.click(banner)
    await waitFor(() => expect(screen.getAllByText(/^Your Business$/i).length).toBeGreaterThan(0), { timeout: 8000 })
    expect(screen.queryByRole('button', { name: /^Get Started$/i })).toBeNull()
    expect(screen.getByPlaceholderText(/Smith Design/i)).toBeTruthy()
  }, 30000)
})
