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
import { buildLbaPromptEmail } from './_lbaEmails.js'
import { accruedInterest, fetchLedgers } from './_money.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = process.env.CRON_SECRET

// Chase stage timing — days from due date (negative = before due)
// Chase ladder — mirrors src/constants.js. Escalation is by WEIGHT, not
// frequency: the spacing widens as the debt ages, the informal phase ends
// at day 30, and everything past that is formal and monthly, generated
// rather than enumerated so a debt is never left without a next step.
const CHASE_STAGES = [
  { id: 'reminder_1',   dfd: -5, phase: 'pre_due' },
  { id: 'reminder_2',   dfd: -1, phase: 'pre_due' },
  { id: 'final_warning',dfd:  0, phase: 'pre_due' },
  { id: 'first_chase',  dfd:  1, phase: 'chasing' },
  { id: 'second_chase', dfd:  7, phase: 'chasing' },
  { id: 'third_chase',  dfd: 14, phase: 'chasing' },
  { id: 'chase_4',      dfd: 21, phase: 'chasing' },
  { id: 'final_notice', dfd: 30, phase: 'chasing' },
]

const FORMAL_FROM_DAYS = 30
const FORMAL_INTERVAL_DAYS = 30

// The stage that should be current for a given lateness. Past day 30 these
// are generated (formal_1 at day 60, formal_2 at day 90, ...) so the ladder
// never runs out; each id stays unique for chase_log's one-send-per-stage
// index.
function stageForDay(dfd) {
  if (dfd > FORMAL_FROM_DAYS) {
    const cycle = Math.floor((dfd - FORMAL_FROM_DAYS) / FORMAL_INTERVAL_DAYS)
    if (cycle >= 1) {
      return {
        id: `formal_${cycle}`,
        dfd: FORMAL_FROM_DAYS + cycle * FORMAL_INTERVAL_DAYS,
        phase: 'formal',
      }
    }
  }
  let match = CHASE_STAGES[0]
  for (const st of CHASE_STAGES) if (st.dfd <= dfd) match = st
  return match
}

const STAGE_ORDER = CHASE_STAGES.map(s => s.id)

const STAGE_LABELS = {
  reminder_1: 'Friendly Reminder', reminder_2: 'Second Reminder',
  final_warning: 'Final Warning', first_chase: 'First Chase',
  second_chase: 'Second Chase', third_chase: 'Third Chase',
  chase_4: 'Fourth Chase', final_notice: 'Final Notice',
}

const STAGE_COLORS = {
  reminder_1: '#1e5fa0', reminder_2: '#2d72b8', final_warning: '#b45309',
  first_chase: '#d97706', second_chase: '#c2410c', third_chase: '#b91c1c',
  chase_4: '#9f1239', final_notice: '#7f1d1d',
}

// Generated formal stages have no entry in the maps above.
function stageLabel(id) {
  if (STAGE_LABELS[id]) return STAGE_LABELS[id]
  const m = /^formal_(\d+)$/.exec(id || '')
  return m ? `Formal Reminder ${m[1]}` : (id || 'Chase')
}
function stageColor(id) {
  return STAGE_COLORS[id] || '#18181b'
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
  // Past the enumerated ladder the next stage is the next monthly formal
  // reminder, so there is always one.
  if (idx < 0) {
    const m = /^formal_(\d+)$/.exec(stageId || '')
    return m ? `formal_${Number(m[1]) + 1}` : null
  }
  if (idx >= STAGE_ORDER.length - 1) return 'formal_1'
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
  const color = stageColor(stage)
  const stageName = stageLabel(stage)
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
        <p>Before we send a <strong>${stageName}</strong> to <strong>${invoice.client_name}</strong>, we wanted to check in with you first.</p>
        <div style="background:#f1f3f6;padding:16px 18px;border-radius:8px;margin:20px 0;font-size:13px;">
          <div style="font-weight:600;color:#0f172a;margin-bottom:8px;">Invoice Details</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:3px 0;color:#64748b;">Reference</td><td style="padding:3px 0;font-weight:500;text-align:right;">${invoice.ref}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Client</td><td style="padding:3px 0;font-weight:500;text-align:right;">${invoice.client_name}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Amount</td><td style="padding:3px 0;font-weight:500;text-align:right;">${fmt(invoice.amount)}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Due Date</td><td style="padding:3px 0;font-weight:500;text-align:right;">${formatDate(invoice.due_date)}</td></tr>
            <tr><td style="padding:3px 0;color:#64748b;">Pending Stage</td><td style="padding:3px 0;font-weight:600;color:${color};text-align:right;">${stageName}</td></tr>
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
  // Accept the secret via Authorization header OR ?secret= query param.
  // Query-param fallback is needed because external cron services (cron-job.org)
  // hitting the apex domain follow the 308 redirect to www and drop the
  // Authorization header on the way through.
  if (!CRON_SECRET) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  const headerOk = req.headers.authorization === `Bearer ${CRON_SECRET}`
  const querySecret = typeof req.query?.secret === 'string' ? req.query.secret : null
  const queryOk = querySecret !== null && querySecret === CRON_SECRET
  if (!headerOk && !queryOk) {
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

  // Reverse direction: an 'overdue' invoice whose due date is today or
  // later means the user adjusted the date forward — it's really pending
  // and must not be chased or accrue charges. Self-heals rows written
  // before the due-date-adjust flow learned to flip the status itself.
  await supabase
    .from('invoices')
    .update({ status: 'pending', chase_stage: null })
    .eq('status', 'overdue')
    .gte('due_date', today)

  // ── Step 2: Find users with active subscriptions ──────────────────────────
  // 'trialing' rows whose trial_end has passed must be excluded — if a user
  // never converts to paid, no Stripe webhook fires and the row sits at
  // 'trialing' forever, which would otherwise keep them being chased after
  // their trial expired.
  const { data: activeSubs } = await supabase
    .from('subscriptions')
    .select('user_id, status, trial_end')
    .in('status', ['active', 'trialing'])

  const now = Date.now()
  const activeUserIds = [...new Set(
    (activeSubs || [])
      .filter(s => s.status === 'active' || (s.status === 'trialing' && s.trial_end && new Date(s.trial_end).getTime() > now))
      .map(s => s.user_id)
  )]

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
    .order('sent_at', { ascending: false })

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

      // Load logs early — used for both stage reconciliation and
      // check-in re-send cadence.
      const invoiceLogs = logsByInvoice[invoice.id] || []

      const dfd = daysSinceDue(invoice.due_date)

      // Parked: the user chose to stop chasing without writing the debt
      // off. Still owed, still accruing, just quiet.
      if (invoice.parked_at) { results.skipped++; continue }

      // Day 30 is where this stops being a chase and becomes a legal
      // process. Tell the user once, whatever else happens today.
      if (dfd >= FORMAL_FROM_DAYS && !invoice.lba_sent_at) {
        const alreadyPrompted = invoiceLogs.some(l => l.status === 'lba_prompt_sent')
        if (!alreadyPrompted) {
          try {
            // Quote the real figure including accrued charges, so the
            // letter and the email can't disagree.
            const ledger = (await fetchLedgers(supabase, [invoice.id]))[invoice.id] ?? null
            const finesOn = !invoice.no_fines && invoice.client_type !== 'consumer'
            const outstandingNow = Math.max(0, Math.round(
              (Number(invoice.amount) - (Number(invoice.amount_paid) || 0)) * 100) / 100)
            const debtAtDue = Math.max(0, Math.round(
              (Number(invoice.amount) - (Number(invoice.paid_before_due) || 0)) * 100) / 100)
            const owed = finesOn
              ? Math.round((outstandingNow
                  + accruedInterest(invoice, ledger, DAILY_RATE)
                  + (outstandingNow > 0 && debtAtDue > 0 ? penalty(debtAtDue) : 0)) * 100) / 100
              : outstandingNow
            const lba = buildLbaPromptEmail(invoice, profile, dfd, owed)
            await sendViaResend({
              from: 'Hielda <notifications@hielda.com>',
              to: [profile.email],
              subject: lba.subject,
              html: lba.html,
            })
            await supabase.from('chase_log').insert({
              invoice_id: invoice.id,
              user_id: invoice.user_id,
              chase_stage: 'lba_prompt',
              email_to: profile.email,
              status: 'lba_prompt_sent',
            })
            results.lba_prompts_sent = (results.lba_prompts_sent || 0) + 1
          } catch (e) {
            console.error(`[auto-chase] LBA prompt failed for ${invoice.id}:`, e.message)
          }
        }
      }

      // The stage this invoice's lateness calls for. Past day 30 these are
      // generated monthly, so there is always a next step — the old
      // index-based walk ran off the end of the array at day 45 and left
      // the debt in permanent silence.
      const nextStage = stageForDay(dfd)
      let nextStageId = nextStage.id

      // Is this stage due to fire today?
      if (nextStage.dfd > dfd) { results.skipped++; continue }

      // Keep the denormalised chase_stage in step. chase_log is the source
      // of truth for what actually went out; this column is for display.
      if (invoice.chase_stage !== nextStageId) {
        await supabase.from('invoices').update({ chase_stage: nextStageId }).eq('id', invoice.id)
      }

      // If a chase has already been sent for this stage, we're done.
      const sentLog = invoiceLogs.find(l => l.chase_stage === nextStageId && l.status === 'sent')
      if (sentLog) { results.skipped++; continue }

      // If a check-in was sent for this stage and it's been less than 3 days,
      // wait — don't spam the freelancer. After 3+ days of silence we re-send
      // the check-in to nudge them. Logs are already sorted sent_at DESC, so
      // .find returns the most recent check-in.
      const checkInLog = invoiceLogs.find(l => l.chase_stage === nextStageId && l.status === 'check_in_sent')
      if (checkInLog) {
        const daysSinceCheckIn = Math.floor((Date.now() - new Date(checkInLog.sent_at).getTime()) / 86400000)
        if (daysSinceCheckIn < 3) { results.skipped++; continue }
      }

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

  // ── Lead drip ──────────────────────────────────────────────────────────
  // Piggybacks on this daily cron (Hobby plan caps deployments at 12
  // serverless functions, so the drip can't be its own endpoint). A drip
  // failure must never affect the invoice-chasing results above.
  let leadDrip = null
  try {
    const { runLeadDrip } = await import('./_leadDrip.js')
    leadDrip = await runLeadDrip(supabase, RESEND_API_KEY)
  } catch (e) {
    leadDrip = { error: e.message }
  }

  return res.status(200).json({
    success: true,
    ...results,
    ...(errors.length > 0 ? { error_detail: errors } : {}),
    lead_drip: leadDrip,
  })
}
