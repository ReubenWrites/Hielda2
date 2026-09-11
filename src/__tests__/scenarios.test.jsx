import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../components/Dashboard'
import Detail from '../components/Detail'
import LetterBeforeAction from '../components/LetterBeforeAction'

// A broad sweep: every major page rendered against a matrix of user
// profiles and invoice states. It exists because a ladder change once took
// out every overdue invoice page in production — the kind of break that a
// unit test on the ladder itself sails straight past.

vi.mock('../supabase', () => {
  const chain = {
    select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
    limit: () => chain, gte: () => chain, ilike: () => chain,
    single: () => Promise.resolve({ data: null }),
    then: (resolve) => resolve({ data: [] }),
  }
  return { supabase: { from: () => chain } }
})
vi.mock('../posthog', () => ({ trackEvent: vi.fn() }))

const d = (offset) => {
  const x = new Date()
  x.setDate(x.getDate() + offset)
  return x.toISOString().split('T')[0]
}

// Deliberately varied users, including ones who have filled in almost nothing.
const PROFILES = {
  'brand new, nothing filled in': { id: 'u1', email: 'new@example.com' },
  'sole trader, no business name': {
    id: 'u2', email: 'sole@example.com', full_name: 'Jo Bloggs',
    sort_code: '11-22-33', account_number: '12345678', account_name: 'J Bloggs',
  },
  'VAT-registered limited company': {
    id: 'u3', email: 'ltd@example.com', full_name: 'Priya Shah',
    business_name: 'Shah Creative Ltd', vat_number: 'GB123456789',
    address: '1 High Street\nLeeds\nLS1 1AA', sort_code: '20-00-00',
    account_number: '87654321', account_name: 'Shah Creative Ltd',
    website_url: 'https://shahcreative.example.com', invoice_signoff: 'Thanks as always.',
  },
  'international, IBAN only': {
    id: 'u4', email: 'intl@example.com', business_name: 'Nordwind GmbH',
    iban: 'DE89370400440532013000', swift_bic: 'COBADEFFXXX',
  },
  'long everything (overflow check)': {
    id: 'u5', email: 'averyveryverylongemailaddressindeed@subdomain.example.co.uk',
    full_name: 'Bartholomew Fitzwilliam-Montgomery III',
    business_name: 'Bartholomew Fitzwilliam-Montgomery Creative Consultancy Partners Limited',
    address: 'Flat 12, The Old Biscuit Factory, 100 Something Very Long Road\nLondon\nSE1 1AA',
    sort_code: '30-30-30', account_number: '11112222', account_name: 'B Fitzwilliam-Montgomery',
  },
}

const base = {
  id: 'inv-x', user_id: 'u1', ref: 'INV-0001', client_name: 'Acme Ltd',
  client_email: 'ap@acme.example.com', amount: 1200, amount_paid: 0,
  paid_before_due: 0, status: 'overdue', due_date: d(-10), issue_date: d(-40),
  payment_term_days: 30, description: 'Consulting', client_type: 'business',
  no_fines: false, chase_stage: 'second_chase',
}

const SCENARIOS = {
  'pending, not yet due': { ...base, status: 'pending', due_date: d(14), chase_stage: null },
  'due today': { ...base, status: 'pending', due_date: d(0), chase_stage: 'final_warning' },
  'one day overdue': { ...base, status: 'overdue', due_date: d(-1), chase_stage: 'first_chase' },
  'part-paid, overdue': { ...base, amount_paid: 400, due_date: d(-20), chase_stage: 'third_chase' },
  'paid before due, overdue remainder': { ...base, amount_paid: 900, paid_before_due: 900, due_date: d(-25) },
  'past 30 days, LBA available': { ...base, due_date: d(-35), chase_stage: 'final_notice' },
  'LBA sent, clock running': { ...base, due_date: d(-40), chase_stage: 'final_notice', lba_sent_at: d(-3), lba_deadline: d(11), client_entity: 'company' },
  'LBA deadline expired, decision point': { ...base, due_date: d(-60), chase_stage: 'formal_1', lba_sent_at: d(-20), lba_deadline: d(-6), client_entity: 'company' },
  'sole trader debtor, 30-day window': { ...base, due_date: d(-45), lba_sent_at: d(-2), lba_deadline: d(28), client_entity: 'sole_trader' },
  'parked debt': { ...base, due_date: d(-120), chase_stage: 'formal_3', parked_at: new Date().toISOString() },
  'deep formal recovery, 400 days': { ...base, due_date: d(-400), chase_stage: 'formal_12' },
  'six years old, still claimable': { ...base, due_date: d(-2100), chase_stage: 'formal_69' },
  'consumer client, no statutory fines': { ...base, client_type: 'consumer', no_fines: true, due_date: d(-40) },
  'fines waived by the user': { ...base, no_fines: true, due_date: d(-50) },
  'VAT invoice': { ...base, amount: 1000, vat_amount: 200, total_with_vat: 1200, line_items: [{ description: 'Design', amount: 1000, vatRate: '20' }] },
  'overpaid, charges collected': { ...base, status: 'paid', amount_paid: 1290, paid_date: d(-1) },
  'settled short, goodwill': { ...base, status: 'paid', amount_paid: 1150, paid_date: d(-2) },
  'disputed': { ...base, status: 'disputed', dispute_reason: 'Scope disagreement', dispute_date: new Date().toISOString() },
  'zero amount': { ...base, amount: 0, status: 'overdue', due_date: d(-5) },
  'very large debt': { ...base, amount: 250000, due_date: d(-90), chase_stage: 'formal_2' },
  'missing client name and email': { ...base, client_name: null, client_email: null },
  'missing description and issue date': { ...base, description: null, issue_date: null },
  'unknown legacy chase stage': { ...base, chase_stage: 'recovery_7' },
  'long text everywhere': {
    ...base,
    ref: 'INV-2026-000123-WEEK-FORTY-TWO-REVISION-B',
    client_name: 'The Extremely Long Client Company Name Partnership LLP',
    description: 'A very long description of the work carried out '.repeat(12),
    client_address: 'Unit 4, The Really Long Business Park Name, Somewhere\nManchester\nM1 1AA',
    notes: 'Please quote the purchase order on your remittance advice. '.repeat(10),
  },
}

const renderSafely = (ui) => {
  let thrown = null
  try {
    render(<MemoryRouter>{ui}</MemoryRouter>)
  } catch (e) {
    thrown = e
  }
  return thrown
}

describe('invoice detail across every profile and scenario', () => {
  beforeEach(() => vi.clearAllMocks())

  for (const [profileName, profile] of Object.entries(PROFILES)) {
    for (const [scenarioName, inv] of Object.entries(SCENARIOS)) {
      it(`${profileName} / ${scenarioName}`, () => {
        expect(renderSafely(
          <Detail inv={{ ...inv, user_id: profile.id }} profile={profile} onUpdate={() => {}} isMobile={false} />
        )).toBeNull()
      })
    }
  }
})

describe('invoice detail on a phone', () => {
  for (const [scenarioName, inv] of Object.entries(SCENARIOS)) {
    it(`mobile / ${scenarioName}`, () => {
      expect(renderSafely(
        <Detail inv={inv} profile={PROFILES['VAT-registered limited company']} onUpdate={() => {}} isMobile />
      )).toBeNull()
    })
  }
})

describe('letter before action drafts for every scenario', () => {
  for (const [profileName, profile] of Object.entries(PROFILES)) {
    for (const [scenarioName, inv] of Object.entries(SCENARIOS)) {
      it(`${profileName} / ${scenarioName}`, () => {
        expect(renderSafely(
          <LetterBeforeAction inv={inv} profile={profile} onUpdate={() => {}} />
        )).toBeNull()
      })
    }
  }
})

describe('dashboard with varied portfolios', () => {
  const all = Object.values(SCENARIOS)
  const cases = {
    'no invoices at all': [],
    'a single pending invoice': [SCENARIOS['pending, not yet due']],
    'everything at once': all,
    'one client, several overdue': [
      { ...base, id: 'a', ref: 'INV-A', due_date: d(-40) },
      { ...base, id: 'b', ref: 'INV-B', due_date: d(-20) },
      { ...base, id: 'c', ref: 'INV-C', due_date: d(-5) },
    ],
    'all paid': all.filter((i) => i.status === 'paid'),
    'all parked': [SCENARIOS['parked debt']],
  }
  for (const [name, invs] of Object.entries(cases)) {
    for (const mobile of [false, true]) {
      it(`${name}${mobile ? ' (phone)' : ''}`, () => {
        expect(renderSafely(
          <Dashboard invs={invs} profile={PROFILES['sole trader, no business name']} onUpdate={() => {}} isMobile={mobile} />
        )).toBeNull()
      })
    }
  }
})
