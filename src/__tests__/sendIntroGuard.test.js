import { describe, it, expect, vi, beforeEach } from 'vitest'

// The server-side guarantee behind the creation form's decision. Whatever
// the browser asks for, an invoice the user marked as "I'll send it myself"
// must never produce an email to the client from this endpoint.

const invoiceRow = { id: 'inv-1', user_id: 'u1', ref: 'INV-0011', send_method: 'download', line_items: [], amount: 150 }
let sendMethod = 'download'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'me@example.com' } }, error: null }) },
    from: (table) => {
      const chain = {
        select: () => chain, eq: () => chain,
        single: async () => table === 'invoices'
          ? { data: { ...invoiceRow, send_method: sendMethod }, error: null }
          : { data: { full_name: 'Reuben', email: 'me@example.com' }, error: null },
      }
      return chain
    },
  }),
}))
vi.mock('../../api/_invoicePdfAttachment.js', () => ({ getInvoicePdfAttachment: async () => null }))

const req = (over = {}) => ({
  method: 'POST',
  body: {
    client_name: 'Matthew Osborn Media Ltd', client_email: 'matthew@example.com',
    intro_text: 'Hi Matthew, invoice attached.', invoice_id: 'inv-1', user_token: 'tok',
    ...over,
  },
})
const res = () => {
  const r = { code: 200, payload: null }
  r.status = (c) => { r.code = c; return r }
  r.json = (p) => { r.payload = p; return r }
  r.setHeader = () => r
  r.send = (p) => { r.payload = p; return r }
  return r
}

async function load() {
  vi.resetModules()
  process.env.RESEND_API_KEY = 'test'
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co'
  process.env.SUPABASE_URL = 'https://x.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc'
  process.env.SUPABASE_SERVICE_KEY = 'svc'
  return (await import('../../api/send-intro-email.js')).default
}

describe('send-intro-email honours the invoice send method', () => {
  let resendCalls
  beforeEach(() => {
    resendCalls = []
    global.fetch = vi.fn(async (url) => {
      resendCalls.push(String(url))
      return { ok: true, json: async () => ({ id: 'email-1' }) }
    })
  })

  it('refuses to email the client when the invoice is marked "I\'ll send it myself"', async () => {
    sendMethod = 'download'
    const handler = await load()
    const r = res()
    await handler(req(), r)
    expect(r.code).toBe(409)
    expect(r.payload?.code).toBe('send_method_download')
    expect(resendCalls.filter((u) => u.includes('resend.com'))).toHaveLength(0)
  })

  it('still sends when the user asked Hielda to send', async () => {
    sendMethod = 'portal'
    const handler = await load()
    const r = res()
    await handler(req(), r)
    expect(r.code).toBe(200)
    expect(resendCalls.some((u) => u.includes('resend.com'))).toBe(true)
  })

  it('404s rather than emailing off a bogus invoice id', async () => {
    sendMethod = 'portal'
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
        from: () => {
          const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: null, error: null }) }
          return chain
        },
      }),
    }))
    const handler = await load()
    const r = res()
    await handler(req({ invoice_id: 'not-mine' }), r)
    expect(r.code).toBe(404)
    expect(resendCalls.filter((u) => u.includes('resend.com'))).toHaveLength(0)
    vi.doUnmock('@supabase/supabase-js')
  })
})
