import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// Mock supabase before importing components
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}))

import { Badge, Btn, Card, StatCard, ShieldLogo, Spinner, ErrorBanner, InfoBanner } from '../components/ui'

describe('UI Components', () => {
  describe('Badge', () => {
    it('renders children text', () => {
      render(<Badge>pending</Badge>)
      expect(screen.getByText('pending')).toBeInTheDocument()
    })

    it('has role="status"', () => {
      render(<Badge>test</Badge>)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('Btn', () => {
    it('renders button text', () => {
      render(<Btn>Click me</Btn>)
      expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    it('calls onClick when clicked', () => {
      const fn = vi.fn()
      render(<Btn onClick={fn}>Click</Btn>)
      screen.getByText('Click').click()
      expect(fn).toHaveBeenCalledOnce()
    })

    it('does not call onClick when disabled', () => {
      const fn = vi.fn()
      render(<Btn onClick={fn} dis>Click</Btn>)
      screen.getByText('Click').click()
      expect(fn).not.toHaveBeenCalled()
    })

    it('renders different variants', () => {
      const { container: c1 } = render(<Btn v="primary">P</Btn>)
      const { container: c2 } = render(<Btn v="ghost">G</Btn>)
      const { container: c3 } = render(<Btn v="danger">D</Btn>)
      const { container: c4 } = render(<Btn v="success">S</Btn>)
      expect(c1.querySelector('button')).toBeInTheDocument()
      expect(c2.querySelector('button')).toBeInTheDocument()
      expect(c3.querySelector('button')).toBeInTheDocument()
      expect(c4.querySelector('button')).toBeInTheDocument()
    })
  })

  describe('Card', () => {
    it('renders children', () => {
      render(<Card>Card content</Card>)
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('is clickable when onClick provided', () => {
      const fn = vi.fn()
      render(<Card onClick={fn}>Clickable</Card>)
      screen.getByText('Clickable').click()
      expect(fn).toHaveBeenCalledOnce()
    })

    it('has button role when clickable', () => {
      render(<Card onClick={() => {}}>Clickable</Card>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('StatCard', () => {
    it('renders label and value', () => {
      render(<StatCard label="Test" value="£100" color="#000" borderColor="#000" />)
      expect(screen.getByText('Test')).toBeInTheDocument()
      expect(screen.getByText('£100')).toBeInTheDocument()
    })

    it('renders sub text when provided', () => {
      render(<StatCard label="L" value="V" sub="subtitle" color="#000" borderColor="#000" />)
      expect(screen.getByText('subtitle')).toBeInTheDocument()
    })
  })

  describe('ShieldLogo', () => {
    it('renders an SVG', () => {
      const { container } = render(<ShieldLogo />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('is aria-hidden', () => {
      const { container } = render(<ShieldLogo />)
      expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true')
    })
  })

  describe('Spinner', () => {
    it('has loading role', () => {
      render(<Spinner />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('ErrorBanner', () => {
    it('renders nothing when no message', () => {
      const { container } = render(<ErrorBanner message="" />)
      expect(container.innerHTML).toBe('')
    })

    it('renders error message', () => {
      render(<ErrorBanner message="Something broke" />)
      expect(screen.getByText('Something broke')).toBeInTheDocument()
    })

    it('has alert role', () => {
      render(<ErrorBanner message="Error" />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('calls onDismiss when X clicked', () => {
      const fn = vi.fn()
      render(<ErrorBanner message="Error" onDismiss={fn} />)
      screen.getByLabelText('Dismiss error').click()
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('InfoBanner', () => {
    it('renders nothing when no message', () => {
      const { container } = render(<InfoBanner message="" />)
      expect(container.innerHTML).toBe('')
    })

    it('renders info message', () => {
      render(<InfoBanner message="Check your email" />)
      expect(screen.getByText('Check your email')).toBeInTheDocument()
    })
  })
})

// Test AuthScreen rendering
import AuthScreen from '../components/AuthScreen'

describe('AuthScreen', () => {
  it('renders login form by default', () => {
    render(<AuthScreen onAuth={() => {}} />)
    expect(screen.getByText('Hielda')).toBeInTheDocument()
    expect(screen.getByText('Log In')).toBeInTheDocument()
    expect(screen.getByText('Create an account')).toBeInTheDocument()
  })

  it('shows signup form when toggled', async () => {
    render(<AuthScreen onAuth={() => {}} />)
    await act(() => screen.getByText('Create an account').click())
    expect(screen.getByText('Create Account')).toBeInTheDocument()
    expect(screen.getByText('Log in')).toBeInTheDocument()
  })

  it('has email and password inputs', () => {
    render(<AuthScreen onAuth={() => {}} />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })
})

// Test SubscriptionGate
import SubscriptionGate from '../components/SubscriptionGate'

describe('SubscriptionGate', () => {
  it('renders children when no subscription (dev mode)', () => {
    render(
      <SubscriptionGate subscription={null} onUpgrade={() => {}}>
        <div>Dashboard</div>
      </SubscriptionGate>
    )
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders children with active subscription', () => {
    render(
      <SubscriptionGate subscription={{ status: 'active' }} onUpgrade={() => {}}>
        <div>Dashboard</div>
      </SubscriptionGate>
    )
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows trial banner during trial', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 5)
    render(
      <SubscriptionGate subscription={{ status: 'trialing', trial_end: futureDate.toISOString() }} onUpgrade={() => {}}>
        <div>Dashboard</div>
      </SubscriptionGate>
    )
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Upgrade')).toBeInTheDocument()
  })

  it('shows paywall when trial expired', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    render(
      <SubscriptionGate subscription={{ status: 'trialing', trial_end: pastDate.toISOString() }} onUpgrade={() => {}}>
        <div>Dashboard</div>
      </SubscriptionGate>
    )
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.getByText('Your free trial has ended')).toBeInTheDocument()
  })

  it('shows past_due warning', () => {
    render(
      <SubscriptionGate subscription={{ status: 'past_due' }} onUpgrade={() => {}}>
        <div>Dashboard</div>
      </SubscriptionGate>
    )
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.getByText('Your free trial has ended')).toBeInTheDocument()
  })
})

// Test Onboarding
import Onboarding from '../components/Onboarding'

describe('Onboarding', () => {
  const mockUser = { id: '123', email: 'test@test.com', user_metadata: { full_name: 'Test User' } }

  it('renders welcome step first', () => {
    render(<Onboarding user={mockUser} profile={null} onComplete={() => {}} />)
    expect(screen.getByText('Welcome to Hielda')).toBeInTheDocument()
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('shows all three feature descriptions', () => {
    render(<Onboarding user={mockUser} profile={null} onComplete={() => {}} />)
    expect(screen.getByText('Create invoices')).toBeInTheDocument()
    expect(screen.getByText('Automatic chasing')).toBeInTheDocument()
    expect(screen.getByText('Legal enforcement')).toBeInTheDocument()
  })

  it('navigates to step 2 when Get Started clicked', async () => {
    render(<Onboarding user={mockUser} profile={null} onComplete={() => {}} />)
    await act(() => screen.getByText('Get Started').click())
    expect(screen.getByText('Your Business')).toBeInTheDocument()
    expect(screen.getByLabelText('Full Name')).toHaveValue('Test User')
  })
})
