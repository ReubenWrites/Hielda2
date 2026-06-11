// Shared building blocks for lead emails: the capture emails sent by
// calculator-lead.js and the drip sequence sent by lead-drip.js.
//
// Drip design (deliberately not aggressive):
//   Stage 1  instant     — calculation summary / letter template (capture)
//   Stage 2  +8 days     — "did they pay?" + the chasing playbook
//   Stage 3  +8d (or +4d if they opened stage 2) — retrospective claims angle
//   Stage 4  openers only — discount offer; the sequence always ends here
// Non-openers stop after stage 3. Every email carries an unsubscribe link
// and a List-Unsubscribe header.

import crypto from 'node:crypto'

export const MAX_STAGE = 4
export const BASE_INTERVAL_DAYS = 8
export const ENGAGED_INTERVAL_DAYS = 4
export const CONVERTED_STAGE = 99

// 50% off the first 3 months. The code must exist in Stripe (Products →
// Coupons → create coupon + promotion code "CHASE50"); checkout already
// has allow_promotion_codes enabled.
export const DISCOUNT_CODE = 'CHASE50'
export const DISCOUNT_BLURB = '50% off your first 3 months'

export function newUnsubscribeToken() {
  return crypto.randomBytes(24).toString('hex')
}

export function unsubscribeUrl(email, token) {
  return `https://hielda.com/api/lead-unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`
}

export function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

export function emailShell(bodyHtml, { email, token }) {
  const unsub = unsubscribeUrl(email, token)
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
      <div style="background:#1e5fa0;padding:16px 24px;">
        <div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div>
      </div>
      <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">
        ${bodyHtml}
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
      <a href="https://hielda.com" style="color:#1e5fa0;text-decoration:none;font-weight:600;">hielda.com</a>
      · <a href="https://hielda.com/privacy" style="color:#94a3b8;">Privacy Policy</a>
      · <a href="${unsub}" style="color:#94a3b8;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
}

export function nextStepsHtml() {
  return `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin:20px 0;">
          <div style="font-weight:700;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">Useful next steps</div>
          <p style="margin:0 0 8px;font-size:13px;"><a href="https://hielda.com/late-payment-letter-template" style="color:#1e5fa0;font-weight:600;text-decoration:none;">Generate a formal demand letter</a> — your figures filled in, ready to send</p>
          <p style="margin:0 0 8px;font-size:13px;"><a href="https://hielda.com/guides/client-not-paying-invoice" style="color:#1e5fa0;font-weight:600;text-decoration:none;">Client not paying? The step-by-step playbook</a></p>
          <p style="margin:0;font-size:13px;"><a href="https://hielda.com/guides/letter-before-action" style="color:#1e5fa0;font-weight:600;text-decoration:none;">When and how to send a Letter Before Action</a></p>
        </div>`
}

export function trialCtaHtml() {
  return `
        <p>Hielda automates the entire process: it sends formal chase emails, applies the statutory charges, and escalates through 19 stages — so you never have to ask awkwardly for your own money.</p>

        <div style="text-align:center;margin:28px 0;">
          <a href="https://hielda.com" style="display:inline-block;padding:14px 36px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Start your free 6-week trial</a>
        </div>

        <p style="font-size:13px;color:#64748b;">Your first 6 weeks are completely free. No card required to start — you only pay when you're ready.</p>

        <p>Best,<br/>The Hielda Team</p>`
}

// ── Drip stage content ───────────────────────────────────────────────────
// Each returns { subject, body } — body goes through emailShell which adds
// the unsubscribe footer.

function stage2({ days_overdue }) {
  const opener = days_overdue
    ? `<p>A little while ago you used our late payment calculator for an invoice that was ${days_overdue} days overdue. Did your client pay up?</p>`
    : `<p>A little while ago you used one of our free late payment tools. Did your client pay up?</p>`
  return {
    subject: 'Did your client pay yet?',
    body: `
        <p>Hi there,</p>
        ${opener}
        <p><strong>If yes</strong> — brilliant. Worth knowing: you were still entitled to the statutory interest and the £40–£100 fixed recovery cost, even after payment. Most freelancers never claim it.</p>
        <p><strong>If not</strong> — the single most effective thing you can do this week is send one firm, professional email citing the Late Payment Act with the current total owed. The day-by-day sequence professional credit-control teams use is in our free playbook:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://hielda.com/guides/how-to-chase-late-invoices" style="display:inline-block;padding:12px 28px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Read the chasing playbook</a>
        </div>
        <p style="font-size:13px;">Or skip straight to a <a href="https://hielda.com/late-payment-letter-template" style="color:#1e5fa0;font-weight:600;">ready-to-send demand letter</a> with the interest calculated for you.</p>
        <p>Best,<br/>The Hielda Team</p>`,
  }
}

function stage3() {
  return {
    subject: 'You can claim late fees on invoices from years ago',
    body: `
        <p>Hi there,</p>
        <p>One thing that surprises almost every freelancer we speak to: the Late Payment Act works <strong>retrospectively</strong>.</p>
        <p>Any B2B invoice that was paid late in the last <strong>six years</strong> still carries a claim — the £40–£100 fixed recovery cost per invoice, plus statutory interest for every day it was overdue. Three or four habitually late clients over a couple of years often adds up to a few hundred pounds.</p>
        <p>Ten minutes with your old invoices and the <a href="https://hielda.com/calculator" style="color:#1e5fa0;font-weight:600;">free calculator</a> will tell you what you're sitting on. The <a href="https://hielda.com/guides/freelancer-rights-late-payment" style="color:#1e5fa0;font-weight:600;">full guide to your rights</a> covers how to claim it.</p>
        <p>And for every invoice from now on: this is exactly the bookkeeping Hielda does automatically, so nothing slips through again.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://hielda.com" style="display:inline-block;padding:12px 28px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Start your free 6-week trial</a>
        </div>
        <p>Best,<br/>The Hielda Team</p>`,
  }
}

function stage4() {
  return {
    subject: `${DISCOUNT_BLURB} — because chasing invoices shouldn't be your job`,
    body: `
        <p>Hi there,</p>
        <p>This is the last email in this series, so we'll keep it short.</p>
        <p>If late payments are still part of your life, we'd like to make trying Hielda properly an easy decision: use the code below at checkout for <strong>${DISCOUNT_BLURB}</strong> — on top of the free 6-week trial.</p>
        <div style="background:#f0f7ff;border:1px dashed #1e5fa0;border-radius:10px;padding:18px 24px;margin:20px 0;text-align:center;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Your code</div>
          <div style="font-size:24px;font-weight:700;letter-spacing:2px;color:#1e5fa0;font-family:monospace;">${DISCOUNT_CODE}</div>
        </div>
        <p>Hielda chases every late invoice for you — escalating emails from "your accounts team", statutory interest and the fixed recovery cost applied automatically, you CC'd on everything. You stay the good guy; we're the process.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://hielda.com" style="display:inline-block;padding:14px 36px;background:#1e5fa0;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Start free, use ${DISCOUNT_CODE} at checkout</a>
        </div>
        <p style="font-size:13px;color:#64748b;">No more emails from this series either way — and the free tools stay free forever.</p>
        <p>Best,<br/>The Hielda Team</p>`,
  }
}

export function dripEmail(stage, lead) {
  if (stage === 2) return stage2(lead)
  if (stage === 3) return stage3(lead)
  if (stage === 4) return stage4(lead)
  return null
}

// Send via Resend with the lead_drip tag (lets resend-webhook attribute
// opens) and the List-Unsubscribe header (improves deliverability and
// gives Gmail/Outlook their native unsubscribe button).
export async function sendLeadEmail({ apiKey, to, subject, html, unsubUrl }) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Hielda <hello@hielda.com>',
      to: [to],
      subject,
      html,
      tags: [{ name: 'type', value: 'lead_drip' }],
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  })
  try {
    const data = await resp.json()
    return data?.id || null
  } catch {
    return null
  }
}
