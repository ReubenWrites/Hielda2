import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

// The links in check-in emails act on the user's money and on whether a
// client gets chased. Mail clients prefetch links. So a GET must only ever
// show a confirmation page; the action itself happens on POST.
//
// "Yes, they've paid" used to record a payment and mark the invoice paid on
// GET — a prefetch could close an invoice nobody had touched.

const SECRET = 'svc'
const sign = (data) => {
  const payload = JSON.stringify({ ...data, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

let invoice
let inserts
let updates

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table) => {
      const chain = {
        select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
        limit: async () => ({ data: [], error: null }),
        single: async () => ({
          data: table === 'invoices' ? invoice
            : table === 'subscriptions' ? { status: 'active', trial_end: null }
            : { email: 'me@example.com', full_name: 'Me' },
          error: null,
        }),
        insert: async (rows) => { inserts.push({ table, rows }); return { error: null } },
        update: (patch) => ({ eq: async () => { updates.push({ table, patch }); return { error: null } } }),
        then: (r) => r({ data: [], error: null }),
      }
      return chain
    },
  }),
}))
vi.mock('../../api/_invoicePdfAttachment.js', () => ({ getInvoicePdfAttachment: async () => null }))

const res = () => {
  const r = { code: 200, body: '' }
  r.status = (c) => { r.code = c; return r }
  r.setHeader = () => r
  r.send = (b) => { r.body = String(b); return r }
  r.json = (b) => { r.body = JSON.stringify(b); return r }
  return r
}

async function handler() {
  vi.resetModules()
  process.env.RESEND_API_KEY = 'test'
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET
  return (await import('../../api/check-in-response.js')).default
}

describe('check-in links never act on a GET', () => {
  beforeEach(() => {
    inserts = []
    updates = []
    invoice = {
      id: 'inv-1', user_id: 'u1', ref: 'INV-0009', client_name: 'Acme', client_email: 'ap@acme.example.com',
      amount: 500, amount_paid: 0, paid_before_due: 0, status: 'overdue', due_date: '2026-08-01',
      chase_stage: 'second_chase', auto_chase: true, no_fines: false, client_type: 'business',
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'email-1' }), text: async () => '' }))
  })

  it('"they have paid" on GET shows a confirm form and records nothing', async () => {
    const h = await handler()
    const token = sign({ invoice_id: 'inv-1', chase_stage: 'second_chase', user_id: 'u1' })
    const r = res()
    await h({ method: 'GET', query: { action: 'paid', invoice_id: 'inv-1', token } }, r)
    expect(r.code).toBe(200)
    expect(r.body).toMatch(/<form method="POST"/)
    expect(inserts.filter((i) => i.table === 'invoice_payments')).toHaveLength(0)
    expect(updates.filter((u) => u.table === 'invoices')).toHaveLength(0)
  })

  it('"they have paid" on POST records the payment and marks it paid', async () => {
    const h = await handler()
    const token = sign({ invoice_id: 'inv-1', chase_stage: 'second_chase', user_id: 'u1' })
    const r = res()
    await h({ method: 'POST', query: { action: 'paid', invoice_id: 'inv-1', token } }, r)
    expect(r.code).toBe(200)
    expect(inserts.filter((i) => i.table === 'invoice_payments')).toHaveLength(1)
    const upd = updates.find((u) => u.table === 'invoices')
    expect(upd?.patch?.status).toBe('paid')
  })

  it('"stop chasing" on GET changes nothing', async () => {
    const h = await handler()
    const token = sign({ invoice_id: 'inv-1', chase_stage: 'second_chase', user_id: 'u1' })
    const r = res()
    await h({ method: 'GET', query: { action: 'skip', invoice_id: 'inv-1', token } }, r)
    expect(r.body).toMatch(/<form method="POST"/)
    expect(updates).toHaveLength(0)
  })

  it('an approved chase is refused if auto-chase was switched off after the link was sent', async () => {
    invoice.auto_chase = false
    const h = await handler()
    const token = sign({ invoice_id: 'inv-1', chase_stage: 'second_chase', user_id: 'u1' })
    const r = res()
    await h({ method: 'POST', query: { action: 'chase', invoice_id: 'inv-1', stage: 'second_chase', token } }, r)
    expect(r.body).toMatch(/No chase was sent/)
    expect(global.fetch.mock.calls.filter(([u]) => String(u).includes('resend.com'))).toHaveLength(0)
  })

  it('an approved chase is refused while a Letter Before Action window is running', async () => {
    const soon = new Date(); soon.setDate(soon.getDate() + 10)
    invoice.lba_sent_at = '2026-09-10'
    invoice.lba_deadline = soon.toISOString().split('T')[0]
    const h = await handler()
    const token = sign({ invoice_id: 'inv-1', chase_stage: 'second_chase', user_id: 'u1' })
    const r = res()
    await h({ method: 'POST', query: { action: 'chase', invoice_id: 'inv-1', stage: 'second_chase', token } }, r)
    expect(r.body).toMatch(/Letter Before Action/)
    expect(global.fetch.mock.calls.filter(([u]) => String(u).includes('resend.com'))).toHaveLength(0)
  })
})
