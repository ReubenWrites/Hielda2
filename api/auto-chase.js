// Vercel Cron: Daily automated chase runner
// Runs at 08:00 UTC every day
//
// For each eligible invoice (auto_chase=true, active subscription, has client email):
//   1. Determine which chase stage is due today
//   2. If no check-in sent yet → email the freelancer: "Has your client paid?"
//      - Freelancer clicks "No, send the chase" → chase goes to client (handled by check-in-response.js)
//      - Freelancer clicks "Yes, they've paid" → invoice marked paid
//      - Freelancer doesn't respond → nothing happens; cron checks again tomorrow
//
// Chases are NEVER sent automatically without explicit freelancer approval.
// Also bulk-updates pending→overdue for any past-due invoices.

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { friendlySubject, friendlyBody, legalSubject, legalBody } from './_toneModifiers.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = process.env.CRON_SECRET

// Chase stage timing — days from due date (negative = before due)
const CHASE_STAGES = [
  { id: 'reminder_1',   dfd: -5 },
  { id: 'reminder_2',   dfd: -1 },
  { id: 'final_warning',dfd:  0 },
  { id: 'first_chase',  dfd:  1 },
  { id: 'second_chase', dfd:  6 },
  { id: 'third_chase',  dfd:  9 },
  { id: 'chase_4',      dfd: 11 },
  { id: 'chase_5',      dfd: 13 },
  { id: 'chase_6',      dfd: 15 },
  { id: 'chase_7',      dfd: 17 },
  { id: 'chase_8',      dfd: 19 },
  { id: 'chase_9',      dfd: 21 },
  { id: 'chase_10',     dfd: 23 },
  { id: 'chase_11',     dfd: 25 },
  { id: 'escalation_1', dfd: 26 },
  { id: 'escalation_2', dfd: 27 },
  { id: 'escalation_3', dfd: 28 },
  { id: 'escalation_4', dfd: 29 },
  { id: 'final_notice', dfd: 30 },
  { id: 'recovery_1',  dfd: 31 },
  { id: 'recovery_2',  dfd: 33 },
  { id: 'recovery_3',  dfd: 35 },
  { id: 'recovery_4',  dfd: 37 },
  { id: 'recovery_5',  dfd: 38 },
  { id: 'recovery_6',  dfd: 39 },
  { id: 'recovery_7',  dfd: 40 },
  { id: 'recovery_8',  dfd: 41 },
  { id: 'recovery_9',  dfd: 42 },
  { id: 'recovery_10', dfd: 43 },
  { id: 'recovery_11', dfd: 44 },
  { id: 'recovery_final', dfd: 45 },
]

const STAGE_ORDER = CHASE_STAGES.map(s => s.id)

const STAGE_LABELS = {
  reminder_1: 'Friendly Reminder', reminder_2: 'Second Reminder',
  final_warning: 'Final Warning', first_chase: 'First Chase',
  second_chase: 'Second Chase', third_chase: 'Third Chase',
  chase_4: 'Chase 4', chase_5: 'Chase 5', chase_6: 'Chase 6',
  chase_7: 'Chase 7', chase_8: 'Chase 8', chase_9: 'Chase 9',
  chase_10: 'Chase 10', chase_11: 'Chase 11',
  escalation_1: 'Escalation Notice 1', escalation_2: 'Escalation Notice 2',
  escalation_3: 'Escalation Notice 3', escalation_4: 'Escalation Notice 4',
  final_notice: 'Final Notice',
  recovery_1: 'Recovery Notice 1', recovery_2: 'Recovery Notice 2',
  recovery_3: 'Recovery Notice 3', recovery_4: 'Recovery Notice 4',
  recovery_5: 'Imminent Escalation 1', recovery_6: 'Imminent Escalation 2',
  recovery_7: 'Imminent Escalation 3', recovery_8: 'Imminent Escalation 4',
  recovery_9: 'Imminent Escalation 5', recovery_10: 'Imminent Escalation 6',
  recovery_11: 'Imminent Escalation 7', recovery_final: 'Final Recovery Notice',
}

const STAGE_COLORS = {
  reminder_1: '#1e5fa0', reminder_2: '#2d72b8', final_warning: '#b45309',
  first_chase: '#d97706', second_chase: '#c2410c', third_chase: '#b91c1c',
  chase_4: '#9f1239', chase_5: '#9f1239', chase_6: '#9f1239', chase_7: '#9f1239',
  chase_8: '#9f1239', chase_9: '#9f1239', chase_10: '#9f1239', chase_11: '#9f1239',
  escalation_1: '#7f1d1d', escalation_2: '#7f1d1d', escalation_3: '#7f1d1d',
  escalation_4: '#7f1d1d', final_notice: '#7f1d1d',
  recovery_1: '#450a0a', recovery_2: '#450a0a', recovery_3: '#450a0a', recovery_4: '#450a0a',
  recovery_5: '#27272a', recovery_6: '#27272a', recovery_7: '#27272a', recovery_8: '#27272a',
  recovery_9: '#27272a', recovery_10: '#27272a', recovery_11: '#27272a', recovery_final: '#18181b',
}

// ── Utilities ────────────────────────────────────────────────────────────────

let RATE = 11.75
let DAILY_RATE = RATE / 365 / 100

async function loadLiveRate() {
  try {
    const { fetchBoeRate } = await import('./boe-rate.js')
    const { rate } = await fetchBoeRate()
    RATE = 8 + rate
    DAILY_RATE = RATE / 365 / 100
  } catch { /* keep fallback */ }
}

function daysSinceDue(dueDate) {
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / 864e5)
}

function penalty(amount) {
  if (amount < 1000) return 40
  if (amount < 10000) return 70
  return 100
}

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getNextStageId(stageId) {
  const idx = STAGE_ORDER.indexOf(stageId)
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

function signToken(data) {
  const payload = JSON.stringify({ ...data, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  const sig = crypto.createHmac('sha256', SUPABASE_SERVICE_KEY).update(payload).digest('hex')
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

async function sendViaResend({ from, to, cc, bcc, subject, html }) {
  const payload = { from, to, subject, html }
  if (cc?.length) payload.cc = cc
  if (bcc?.length) payload.bcc = bcc
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Resend error')
  return data
}

// ── Check-in email (to the freelancer) ───────────────────────────────────────

function buildCheckInEmail(invoice, profile, stage) {
  const color = STAGE_COLORS[stage] || '#1e5fa0'
  const stageLabel = STAGE_LABELS[stage] || stage
  const fromName = profile.business_name || profile.full_name || 'Hielda User'
  const token = signToken({ invoice_id: invoice.id, chase_stage: stage, user_id: invoice.user_id })
  const base = 'https://www.hielda.com/api/check-in-response'
  const paidUrl = `${base}?action=paid&invoice_id=${invoice.id}&token=${encodeURIComponent(token)}`
  const chaseUrl = `${base}?action=chase&invoice_id=${invoice.id}&stage=${stage}&token=${encodeURIComponent(token)}`
  const subject = `Check-in: Has ${invoice.client_name} paid invoice ${invoice.ref}?`
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:${color};padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
      </div>
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
        <p>Hi ${fromName},</p>
        <p>Before we send a <strong>${stageLabel}</strong> to <strong>${invoice.client_name}</strong>, we wanted to check in with you first.</p>
        <div style="background:#f1f3f6;padding:16px 18px;border-radius:8px;margin:20px 0;font-size:13px;">
          <div style="font-weight:600;color:#0f172a;margin-bottom:8px;">Invoice Details</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:3px 0;color:#64748b;">Reference</td><td style="padding:3px 0;font-weight:500;text-align:right;">${invoice.ref}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Client</td><td style="padding:3px 0;font-weight:500;text-align:right;">${invoice.client_name}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Amount</td><td style="padding:3px 0;font-weight:500;text-align:right;">${fmt(invoice.amount)}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Due Date</td><td style="padding:3px 0;font-weight:500;text-align:right;">${formatDate(invoice.due_date)}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Pending Stage</td><td style="padding:3px 0;font-weight:600;color:${color};text-align:right;">${stageLabel}</td></tr>
          </table>
        </div>
        <p style="font-weight:600;margin-bottom:20px;">Has ${invoice.client_name} paid this invoice?</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${paidUrl}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:0 8px 12px;">Yes, they've paid</a>
          <a href="${chaseUrl}" style="display:inline-block;padding:14px 32px;background:${color};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:0 8px 12px;">No, send the chase</a>
        </div>
        <p style="font-size:12px;color:#94a3b8;text-align:center;">We won't send anything to your client until you give the go-ahead.</p>
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">Sent via Hielda — Protecting your pay.</div>
  </div>
</body>
</html>`
  return { subject, html }
}

// NOTE: Chase emails are built and sent by api/send-chase-email.js (manual) or
// via check-in-response.js (when freelancer approves from check-in link).
// The buildChaseEmail function was removed as dead code — auto-chase only sends check-in emails.

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Verify the request is from Vercel Cron (or a manual test with the secret)
  if (!CRON_SECRET) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured — missing env vars' })
  }

  await loadLiveRate()

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const results = { status_updates: 0, check_ins_sent: 0, skipped: 0, errors: 0 }
  const errors = []

  // ── Step 1: Bulk update pending → overdue for all past-due invoices ──────────
  const today = new Date().toISOString().split('T')[0]
  const { count: updated } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('status', 'pending')
    .lt('due_date', today)

  results.status_updates = updated || 0

  // ── Step 2: Find users with active subscriptions ──────────────────────────
  const { data: activeSubs } = await supabase
    .from('subscriptions')
    .select('user_id')
    .in('status', ['active', 'trialing'])

  const activeUserIds = [...new Set((activeSubs || []).map(s => s.user_id))]

  if (activeUserIds.length === 0) {
    return res.status(200).json({ ...results, message: 'No active subscribers — nothing to chase' })
  }

  // ── Step 3: Fetch eligible invoices with profiles ─────────────────────────
  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .in('status', ['pending', 'overdue'])
    .eq('auto_chase', true)
    .not('client_email', 'is', null)
    .in('user_id', activeUserIds)

  if (invErr) {
    return res.status(500).json({ error: invErr.message })
  }

  if (!invoices || invoices.length === 0) {
    return res.status(200).json({ ...results, message: 'No eligible invoices to chase' })
  }

  // ── Step 4: Fetch profiles for these users ───────────────────────────────
  const userIds = [...new Set(invoices.map(i => i.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  // ── Step 5: Fetch recent chase logs for all these invoices ───────────────
  const invoiceIds = invoices.map(i => i.id)
  const { data: logs } = await supabase
    .from('chase_log')
    .select('*')
    .in('invoice_id', invoiceIds)
    .order('created_at', { ascending: false })

  // Index logs by invoice_id → array of log entries
  const logsByInvoice = {}
  for (const log of (logs || [])) {
    if (!logsByInvoice[log.invoice_id]) logsByInvoice[log.invoice_id] = []
    logsByInvoice[log.invoice_id].push(log)
  }

  // ── Step 6: Process each invoice ─────────────────────────────────────────
  for (const invoice of invoices) {
    try {
      const profile = profileMap[invoice.user_id]
      if (!profile?.email) { results.skipped++; continue }

      // Determine the next stage to send
      let nextStageId = invoice.chase_stage || 'reminder_1'
      const dfd = daysSinceDue(invoice.due_date)

      // Skip forward to the correct stage if we've fallen behind.
      // Without this, an invoice stuck at 'reminder_1' would still get a
      // "friendly reminder" even if it's already overdue — one stale stage
      // per day until it catches up, causing excessive emails.
      const currentIdx = CHASE_STAGES.findIndex(s => s.id === nextStageId)
      if (currentIdx < 0) { results.skipped++; continue }

      let correctIdx = currentIdx
      for (let i = currentIdx + 1; i < CHASE_STAGES.length; i++) {
        if (CHASE_STAGES[i].dfd <= dfd) {
          correctIdx = i
        } else {
          break
        }
      }
      if (correctIdx !== currentIdx) {
        nextStageId = CHASE_STAGES[correctIdx].id
        await supabase.from('invoices').update({ chase_stage: nextStageId }).eq('id', invoice.id)
      }

      const nextStage = CHASE_STAGES[correctIdx]

      // Is this stage due to fire today?
      if (nextStage.dfd > dfd) { results.skipped++; continue }

      // Check the log for this stage on this invoice
      const invoiceLogs = logsByInvoice[invoice.id] || []
      const sentLog = invoiceLogs.find(l => l.chase_stage === nextStageId && l.status === 'sent')
      const checkInLog = invoiceLogs.find(l => l.chase_stage === nextStageId && l.status === 'check_in_sent')

      // Chase already sent for this stage, or check-in already sent — nothing to do today
      if (sentLog || checkInLog) { results.skipped++; continue }

      // No check-in sent yet — send one to the freelancer asking for approval
      const checkInEmail = buildCheckInEmail(invoice, profile, nextStageId)

      await sendViaResend({
        from: 'Hielda <notifications@hielda.com>',
        to: [profile.email],
        subject: checkInEmail.subject,
        html: checkInEmail.html,
      })

      await supabase.from('chase_log').insert({
        invoice_id: invoice.id,
        user_id: invoice.user_id,
        chase_stage: nextStageId,
        email_to: profile.email,
        status: 'check_in_sent',
      })

      results.check_ins_sent++
    } catch (e) {
      console.error(`[auto-chase] Error on invoice ${invoice.id}:`, e.message)
      errors.push({ invoice_id: invoice.id, error: e.message })
      results.errors++
    }
  }

  return res.status(200).json({
    success: true,
    ...results,
    ...(errors.length > 0 ? { error_detail: errors } : {}),
  })
}
