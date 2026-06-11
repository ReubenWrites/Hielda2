// Vercel Serverless Function (cron, daily): lead drip sequence.
//
// Sends the follow-up emails in the lead nurture series to people who used
// the free calculator or letter generator. Engagement-adaptive and finite:
//
//   stage 2 — everyone, 8 days after the capture email
//   stage 3 — everyone, 8 days later (4 if they opened the previous email)
//   stage 4 — discount offer, ONLY for leads who have opened at least one
//             email; the series always ends here
//
// Non-openers stop after stage 3 — emailing people who never open hurts
// deliverability for everything else we send. Unsubscribed leads and leads
// who have since signed up as users are never emailed.
//
// Open tracking: emails are tagged `lead_drip`; resend-webhook.js records
// opens onto the lead row (opened_count / last_opened_at).

import { createClient } from '@supabase/supabase-js'
import {
  MAX_STAGE,
  BASE_INTERVAL_DAYS,
  ENGAGED_INTERVAL_DAYS,
  CONVERTED_STAGE,
  emailShell,
  dripEmail,
  sendLeadEmail,
  unsubscribeUrl,
  newUnsubscribeToken,
} from './_leadEmails.js'

const CRON_SECRET = process.env.CRON_SECRET
const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Cap per run: stays well inside serverless time limits, and any backlog
// simply drains over the following daily runs.
const BATCH_SIZE = 50

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString()

export default async function handler(req, res) {
  if (!CRON_SECRET) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  const headerOk = req.headers.authorization === `Bearer ${CRON_SECRET}`
  const querySecret = typeof req.query?.secret === 'string' ? req.query.secret : null
  if (!headerOk && !(querySecret !== null && querySecret === CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured — missing env vars' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const results = { sent: 0, skipped_not_due: 0, skipped_converted: 0, stopped_unengaged: 0, errors: 0 }
  const errors = []

  // Candidates: subscribed leads mid-sequence whose last email is at least
  // the engaged interval old (the per-lead due check below applies the
  // correct 4/8-day interval). last_email_at IS NULL covers legacy leads
  // captured before drip tracking existed — they start from stage 1 as if
  // their capture email just aged past the interval.
  const { data: leads, error: qErr } = await supabase
    .from('calculator_leads')
    .select('id, email, days_overdue, drip_stage, last_email_at, opened_count, last_opened_at, unsubscribe_token, created_at')
    .eq('unsubscribed', false)
    .gte('drip_stage', 1)
    .lt('drip_stage', MAX_STAGE)
    .or(`last_email_at.is.null,last_email_at.lte.${daysAgo(ENGAGED_INTERVAL_DAYS)}`)
    .limit(BATCH_SIZE)

  if (qErr) {
    // Most likely cause: migration 020 not applied yet. Fail loudly but
    // harmlessly — nothing has been sent.
    return res.status(500).json({ error: `Lead query failed (has migration 020_add_lead_drip.sql been applied?): ${qErr.message}` })
  }

  // Leads who became users get parked permanently — they're customers now
  // and in-product communication takes over.
  const emails = (leads || []).map((l) => l.email)
  let userEmails = new Set()
  if (emails.length > 0) {
    const { data: users } = await supabase
      .from('profiles')
      .select('email')
      .in('email', emails)
    userEmails = new Set((users || []).map((u) => (u.email || '').toLowerCase()))
  }

  for (const lead of leads || []) {
    try {
      if (userEmails.has(lead.email.toLowerCase())) {
        await supabase.from('calculator_leads').update({ drip_stage: CONVERTED_STAGE }).eq('id', lead.id)
        results.skipped_converted++
        continue
      }

      const openedLastEmail =
        lead.last_opened_at && lead.last_email_at && new Date(lead.last_opened_at) >= new Date(lead.last_email_at)
      const intervalDays = openedLastEmail ? ENGAGED_INTERVAL_DAYS : BASE_INTERVAL_DAYS
      const anchor = lead.last_email_at || lead.created_at
      const due = !anchor || new Date(anchor) <= new Date(daysAgo(intervalDays))
      if (!due) {
        results.skipped_not_due++
        continue
      }

      const nextStage = lead.drip_stage + 1

      // The discount email only goes to leads who've shown interest.
      // Never-openers end quietly after stage 3.
      if (nextStage === MAX_STAGE && (lead.opened_count || 0) === 0) {
        await supabase.from('calculator_leads').update({ drip_stage: MAX_STAGE }).eq('id', lead.id)
        results.stopped_unengaged++
        continue
      }

      const content = dripEmail(nextStage, lead)
      if (!content) {
        results.errors++
        continue
      }

      // Legacy leads may not have an unsubscribe token yet.
      let token = lead.unsubscribe_token
      if (!token) {
        token = newUnsubscribeToken()
        await supabase.from('calculator_leads').update({ unsubscribe_token: token }).eq('id', lead.id)
      }

      const emailId = await sendLeadEmail({
        apiKey: RESEND_API_KEY,
        to: lead.email,
        subject: content.subject,
        html: emailShell(content.body, { email: lead.email, token }),
        unsubUrl: unsubscribeUrl(lead.email, token),
      })

      await supabase
        .from('calculator_leads')
        .update({
          drip_stage: nextStage,
          last_email_at: new Date().toISOString(),
          last_email_id: emailId,
        })
        .eq('id', lead.id)

      results.sent++
    } catch (e) {
      results.errors++
      errors.push(`${lead.email}: ${e.message}`)
    }
  }

  return res.status(200).json({ ...results, ...(errors.length ? { error_detail: errors.slice(0, 5) } : {}) })
}
