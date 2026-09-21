import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The whole app module must evaluate and mount. On 21 Sep 2026 a helper
// was declared below its first use in App.jsx; every unit test passed and
// the build succeeded, but the bundle threw "Cannot access before
// initialization" at load and nobody could use the app for ~15 minutes.
// Importing App here would have thrown the same error.

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => {
      const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, single: async () => ({ data: null, error: null }), then: (r) => r({ data: [], error: null }) }
      return chain
    },
  },
}))
vi.mock('../posthog', () => ({ initPostHog() {}, identifyUser() {}, resetUser() {}, trackPageView() {}, trackEvent() {} }))

describe('App boots', () => {
  it('evaluates the module and renders the public shell without throwing', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    // jsdom has no matchMedia; App's useMediaQuery needs one.
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    const { ConfirmProvider, ToastProvider } = await import('../components/ui.jsx')
    const App = (await import('../App')).default
    render(
      <MemoryRouter initialEntries={['/']}>
        <ConfirmProvider><ToastProvider><App /></ToastProvider></ConfirmProvider>
      </MemoryRouter>,
    )
    // Logged out at "/": the landing page's primary call to action.
    expect(await screen.findAllByText(/Start Free Trial/i, {}, { timeout: 5000 })).not.toHaveLength(0)
  })
})
