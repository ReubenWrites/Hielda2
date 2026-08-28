// Vercel Serverless Function: Xero integration.
// One endpoint, four POST actions (connect, status, sync, disconnect)
// plus the OAuth callback as a GET. Tokens live only in xero_connections
// (RLS with no policies — service-role access exclusively), so they
// never reach the browser.
//
// Imported invoices arrive with auto_chase OFF: Hielda must never
// surprise-chase a client the user hasn't explicitly put on the ladder.
//
// Env required: XERO_CLIENT_ID, XERO_CLIENT_SECRET (from the Xero
// developer app; redirect URI must be registered EXACTLY as
// https://hielda.com/api/xero). Optional XERO_STATE_SECRET — falls back
// to the service key for HMAC signing of the OAuth state.

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET
const STATE_SECRET = process.env.XERO_STATE_SECRET || SUPABASE_SERVICE_KEY
const REDIRECT_URI = 'https://hielda.com/api/xero'
const SCOPES = 'openid profile email offline_access accounting.transactions.read accounting.contacts.read'

const configured = () => Boolean(XERO_CLIENT_ID && XERO_CLIENT_SECRET && SUPABASE_URL && SUPABASE_SERVICE_KEY)

function signState(userId) {
  const payload = `${userId}.${Date.now()}`
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

function verifyState(state) {
  try {
    const raw = Buffer.from(state, 'base64url').toString()
    const [userId, ts, sig] = raw.split('.')
    const expected = crypto.createHmac('sha256', STATE_SECRET).update(`${userId}.${ts}`).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    // 15-minute window — an OAuth dance takes seconds, not hours
    if (Date.now() - Number(ts) > 15 * 60 * 1000) return null
    return userId
  } catch {
    return null
  }
}

async function tokenRequest(params) {
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams(params).toString(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Xero token request failed (${res.status})`)
  return data
}

// Returns a valid access token, refreshing (and persisting the rotated
// refresh token — Xero rotates on every refresh) when within a minute
// of expiry.
async function freshToken(supabase, conn) {
  if (new Date(conn.token_expires_at).getTime() - Date.now() > 60 * 1000) {
    return conn.access_token
  }
  const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: conn.refresh_token })
  await supabase.from('xero_connections').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq('user_id', conn.user_id)
  return tokens.access_token
}

// Xero JSON dates come as DateString (ISO, no zone) or /Date(ms)/.
function xeroDate(str, msDate) {
  if (str) return str.split('T')[0]
  const m = /\/Date\((\d+)/.exec(msDate || '')
  return m ? new Date(Number(m[1])).toISOString().split('T')[0] : null
}

const round2 = (n) => Math.round(n * 100) / 100
const todayStr = () => new Date().toISOString().split('T')[0]

async function xeroGet(path, accessToken, tenantId, extraHeaders = {}) {
  const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      Accept: 'application/json',
      ...extraHeaders,
    },
  })
  if (res.status === 304) return { Invoices: [] }
  const data = await res.json()
  if (!res.ok) throw new Error(data.Detail || data.Message || `Xero API ${res.status}`)
  return data
}

function mapInvoice(xi, userId) {
  const issue = xeroDate(xi.DateString, xi.Date)
  const due = xeroDate(xi.DueDateString, xi.DueDate) || issue
  const amountPaid = round2((Number(xi.AmountPaid) || 0) + (Number(xi.AmountCredited) || 0))
  const termDays = issue && due
    ? Math.max(0, Math.round((new Date(due) - new Date(issue)) / 864e5))
    : 30
  return {
    user_id: userId,
    xero_invoice_id: xi.InvoiceID,
    source: 'xero',
    ref: xi.InvoiceNumber || `XERO-${(xi.InvoiceID || '').slice(0, 8).toUpperCase()}`,
    description: (xi.LineItems && xi.LineItems[0] && xi.LineItems[0].Description) || 'Imported from Xero',
    client_name: xi.Contact ? xi.Contact.Name : null,
    client_email: xi.Contact ? xi.Contact.EmailAddress || null : null,
    amount: round2(Number(xi.SubTotal) || 0),
    vat_amount: round2(Number(xi.TotalTax) || 0),
    total_with_vat: round2(Number(xi.Total) || 0),
    amount_paid: amountPaid,
    // Payment timing isn't recoverable from the invoice summary, so we
    // assume pre-due — the legally safe direction (never overclaims the
    // fixed-fee tier).
    paid_before_due: Math.min(amountPaid, round2(Number(xi.SubTotal) || 0)),
    issue_date: issue,
    due_date: due,
    payment_term_days: termDays,
    status: due && due < todayStr() ? 'overdue' : 'pending',
    chase_stage: null,
    auto_chase: false,
  }
}

async function runSync(supabase, conn) {
  const accessToken = await freshToken(supabase, conn)
  const counts = { imported: 0, updated: 0, closed: 0, skipped: 0 }

  // Existing links for dedupe / reconciliation
  const { data: linked } = await supabase
    .from('invoices')
    .select('id, xero_invoice_id, amount, amount_paid, status, due_date')
    .eq('user_id', conn.user_id)
    .not('xero_invoice_id', 'is', null)
  const byXeroId = new Map((linked || []).map((r) => [r.xero_invoice_id, r]))

  // Open receivables, newest first, up to 5 pages of 100
  const where = encodeURIComponent('Type=="ACCREC" AND Status=="AUTHORISED"')
  for (let page = 1; page <= 5; page++) {
    const data = await xeroGet(`Invoices?where=${where}&order=Date%20DESC&page=${page}`, accessToken, conn.tenant_id)
    const invoices = data.Invoices || []
    for (const xi of invoices) {
      const existing = byXeroId.get(xi.InvoiceID)
      const mapped = mapInvoice(xi, conn.user_id)
      if (!mapped.due_date || mapped.amount <= 0) { counts.skipped++; continue }
      if (!existing) {
        const { error } = await supabase.from('invoices').insert(mapped)
        if (error) { counts.skipped++; continue }
        counts.imported++
      } else {
        // Reconcile payments Xero knows about that Hielda doesn't
        const prevPaid = Number(existing.amount_paid) || 0
        if (mapped.amount_paid > prevPaid + 0.005) {
          const delta = round2(mapped.amount_paid - prevPaid)
          await supabase.from('invoice_payments').insert({
            invoice_id: existing.id,
            user_id: conn.user_id,
            amount: delta,
            paid_on: xeroDate(xi.FullyPaidOnDateString, xi.FullyPaidOnDate) || todayStr(),
          })
          await supabase.from('invoices').update({ amount_paid: mapped.amount_paid }).eq('id', existing.id)
          counts.updated++
        }
      }
    }
    if (invoices.length < 100) break
  }

  // Close linked invoices Xero has since marked PAID/VOIDED — delta query
  // via If-Modified-Since keeps this cheap after the first sync.
  if (byXeroId.size > 0) {
    const closedWhere = encodeURIComponent('Type=="ACCREC" AND (Status=="PAID" OR Status=="VOIDED")')
    const headers = conn.last_sync_at ? { 'If-Modified-Since': new Date(conn.last_sync_at).toUTCString() } : {}
    const data = await xeroGet(`Invoices?where=${closedWhere}&page=1`, accessToken, conn.tenant_id, headers)
    for (const xi of data.Invoices || []) {
      const existing = byXeroId.get(xi.InvoiceID)
      if (!existing || existing.status === 'paid') continue
      const paidOn = xeroDate(xi.FullyPaidOnDateString, xi.FullyPaidOnDate) || todayStr()
      const cash = round2((Number(xi.AmountPaid) || 0) + (Number(xi.AmountCredited) || 0))
      const prevPaid = Number(existing.amount_paid) || 0
      if (cash > prevPaid + 0.005) {
        await supabase.from('invoice_payments').insert({
          invoice_id: existing.id,
          user_id: conn.user_id,
          amount: round2(cash - prevPaid),
          paid_on: paidOn,
        })
      }
      await supabase.from('invoices').update({
        amount_paid: Math.max(cash, prevPaid),
        status: 'paid',
        paid_date: paidOn,
        chase_stage: null,
      }).eq('id', existing.id)
      counts.closed++
    }
  }

  const summary = `${counts.imported} imported, ${counts.updated} payments reconciled, ${counts.closed} closed, ${counts.skipped} skipped`
  await supabase.from('xero_connections').update({
    last_sync_at: new Date().toISOString(),
    last_sync_result: summary,
  }).eq('user_id', conn.user_id)
  return { ...counts, summary }
}

export default async function handler(req, res) {
  const supabase = configured() ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null

  // ── OAuth callback (browser redirect from Xero) ──
  if (req.method === 'GET') {
    const { code, state, error: oauthError } = req.query
    if (oauthError) return res.redirect(302, '/settings?xero=denied')
    if (!code || !state) return res.status(400).json({ error: 'Missing code/state' })
    if (!configured()) return res.redirect(302, '/settings?xero=error')
    const userId = verifyState(state)
    if (!userId) return res.redirect(302, '/settings?xero=error')
    try {
      const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI })
      // Which Xero org did they authorise? (First tenant — Hielda is
      // single-org per user for now.)
      const connRes = await fetch('https://api.xero.com/connections', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const tenants = await connRes.json()
      const tenant = Array.isArray(tenants) && tenants[0]
      if (!tenant) return res.redirect(302, '/settings?xero=error')
      await supabase.from('xero_connections').upsert({
        user_id: userId,
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName || null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
      })
      return res.redirect(302, '/settings?xero=connected')
    } catch (e) {
      console.error('[xero] callback failed:', e.message)
      return res.redirect(302, '/settings?xero=error')
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, user_token } = req.body || {}

  // Status is answerable even before env vars exist — the UI uses it to
  // show a "coming soon" state instead of a broken button.
  if (action === 'status' && !configured()) {
    return res.status(200).json({ configured: false, connected: false })
  }
  if (!configured()) return res.status(500).json({ error: 'Xero integration not configured' })
  if (!user_token) return res.status(401).json({ error: 'Authentication required' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(user_token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid or expired token' })

  try {
    if (action === 'connect') {
      const url = 'https://login.xero.com/identity/connect/authorize?' + new URLSearchParams({
        response_type: 'code',
        client_id: XERO_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        state: signState(user.id),
      }).toString()
      return res.status(200).json({ url })
    }

    const { data: conn } = await supabase
      .from('xero_connections').select('*').eq('user_id', user.id).single()

    if (action === 'status') {
      return res.status(200).json({
        configured: true,
        connected: Boolean(conn),
        tenant_name: conn?.tenant_name || null,
        last_sync_at: conn?.last_sync_at || null,
        last_sync_result: conn?.last_sync_result || null,
      })
    }

    if (!conn) return res.status(400).json({ error: 'Xero is not connected' })

    if (action === 'sync') {
      const result = await runSync(supabase, conn)
      return res.status(200).json({ success: true, ...result })
    }

    if (action === 'disconnect') {
      // Best-effort revoke; the delete is what matters
      try {
        await fetch('https://identity.xero.com/connect/revocation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64'),
          },
          body: new URLSearchParams({ token: conn.refresh_token }).toString(),
        })
      } catch { /* non-fatal */ }
      await supabase.from('xero_connections').delete().eq('user_id', user.id)
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) {
    console.error('[xero] action failed:', action, e.message)
    return res.status(500).json({ error: e.message })
  }
}
