// Supabase Edge Function: Daily chase scheduler
// Called by pg_cron daily at 9am UTC
// Now sends CHECK-IN emails first instead of direct chases.
// If the freelancer hasn't responded to a check-in after 48 hours, sends the chase automatically.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0"
import { encode as hexEncode } from "https://deno.land/std@0.177.0/encoding/hex.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!

const CHASE_STAGES = [
  { id: "reminder_1", dfd: -5 },
  { id: "reminder_2", dfd: -1 },
  { id: "first_chase", dfd: 1 },
  { id: "second_chase", dfd: 14 },
  { id: "final_notice", dfd: 30 },
]

const STAGE_LABELS: Record<string, string> = {
  reminder_1: "Friendly Reminder",
  reminder_2: "Second Reminder",
  first_chase: "First Chase",
  second_chase: "Second Chase + Interest",
  final_notice: "Final Notice",
}

const STAGE_COLORS: Record<string, string> = {
  reminder_1: "#1e5fa0", reminder_2: "#2d72b8", first_chase: "#d97706",
  second_chase: "#c2410c", final_notice: "#9f1239",
}

const AUTO_ESCALATE_MS = 48 * 60 * 60 * 1000 // 48 hours

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function getExpectedStage(daysFromDue: number): string | null {
  for (let i = CHASE_STAGES.length - 1; i >= 0; i--) {
    if (daysFromDue >= CHASE_STAGES[i].dfd) return CHASE_STAGES[i].id
  }
  return null
}

// HMAC token signing using Web Crypto API (Deno-compatible)
async function signToken(data: Record<string, unknown>, secret: string): Promise<string> {
  const payload = JSON.stringify({ ...data, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  const sigHex = new TextDecoder().decode(hexEncode(new Uint8Array(sig)))
  const payloadB64 = btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return payloadB64 + "." + sigHex
}

function buildCheckInEmailHtml(
  invoice: any, profile: any, stage: string, token: string, userEmail: string
): { subject: string; html: string } {
  const color = STAGE_COLORS[stage] || "#1e5fa0"
  const stageLabel = STAGE_LABELS[stage] || stage
  const fromName = profile.business_name || profile.full_name || "Hielda User"
  const baseUrl = "https://hielda2.vercel.app/api/check-in-response"

  const paidUrl = `${baseUrl}?action=paid&invoice_id=${invoice.id}&token=${encodeURIComponent(token)}`
  const chaseUrl = `${baseUrl}?action=chase&invoice_id=${invoice.id}&stage=${stage}&token=${encodeURIComponent(token)}`

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
          <a href="${chaseUrl}" style="display:inline-block;padding:14px 32px;background:${color};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:0 8px 12px;">No, please send the chase</a>
        </div>
        <p style="font-size:12px;color:#94a3b8;text-align:center;">If you don't respond within 48 hours, we'll send the chase automatically.</p>
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
      Sent via Hielda — Protecting your pay.
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const today = new Date()
    const results: any[] = []

    // Get all non-paid invoices with auto_chase enabled (or no auto_chase column = default true)
    const { data: invoices, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .in("status", ["pending", "overdue"])
      .or("auto_chase.is.null,auto_chase.eq.true")

    if (invErr) throw invErr

    for (const invoice of invoices || []) {
      // Check user has active subscription
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, trial_end")
        .eq("user_id", invoice.user_id)
        .single()

      const isActive = sub && (
        sub.status === "active" ||
        (sub.status === "trialing" && new Date(sub.trial_end) > today)
      )

      if (!isActive) continue

      // Skip if no client email
      if (!invoice.client_email) continue

      // Calculate days from due
      const dueDate = new Date(invoice.due_date)
      const daysFromDue = Math.floor((today.getTime() - dueDate.getTime()) / 864e5)

      // Determine which stage this invoice should be at
      const expectedStage = getExpectedStage(daysFromDue)
      if (!expectedStage) continue

      // Check if the chase was already sent for this stage (status='sent')
      const { data: sentLogs } = await supabase
        .from("chase_log")
        .select("id")
        .eq("invoice_id", invoice.id)
        .eq("chase_stage", expectedStage)
        .eq("status", "sent")
        .limit(1)

      if (sentLogs && sentLogs.length > 0) continue // Chase already sent for this stage

      // Check if a check-in was already sent for this stage
      const { data: checkInLogs } = await supabase
        .from("chase_log")
        .select("id, sent_at")
        .eq("invoice_id", invoice.id)
        .eq("chase_stage", expectedStage)
        .eq("status", "check_in_sent")
        .order("sent_at", { ascending: false })
        .limit(1)

      if (checkInLogs && checkInLogs.length > 0) {
        // Check-in was sent — check if 48 hours have passed (auto-escalate)
        const checkInTime = new Date(checkInLogs[0].sent_at).getTime()
        if (today.getTime() - checkInTime < AUTO_ESCALATE_MS) {
          // Still within 48h window, waiting for freelancer response
          continue
        }

        // 48 hours passed with no response — auto-send the chase email
        const { data: sendResult, error: sendErr } = await supabase.functions.invoke(
          "send-chase-email",
          { body: { invoice_id: invoice.id, chase_stage: expectedStage } }
        )

        results.push({
          invoice_id: invoice.id,
          ref: invoice.ref,
          stage: expectedStage,
          type: "auto_escalated_chase",
          success: !sendErr,
          error: sendErr?.message,
        })

        await new Promise((r) => setTimeout(r, 200))
        continue
      }

      // No check-in and no chase sent for this stage — send a check-in email
      // Get user's email from auth
      const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(invoice.user_id)
      if (userErr || !user?.email) {
        results.push({
          invoice_id: invoice.id,
          ref: invoice.ref,
          stage: expectedStage,
          type: "check_in_failed",
          success: false,
          error: "Could not get user email",
        })
        continue
      }

      // Get profile for the check-in email
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", invoice.user_id)
        .single()

      if (!profile) continue

      // Generate signed token
      const token = await signToken({
        invoice_id: invoice.id,
        chase_stage: expectedStage,
        user_id: invoice.user_id,
      }, SUPABASE_SERVICE_ROLE_KEY)

      // Build and send check-in email
      const email = buildCheckInEmailHtml(invoice, profile, expectedStage, token, user.email)

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Hielda <notifications@hielda.com>",
          to: [user.email],
          subject: email.subject,
          html: email.html,
        }),
      })

      const resendData = await resendRes.json()
      const success = resendRes.ok

      if (success) {
        // Log the check-in send
        await supabase.from("chase_log").insert({
          invoice_id: invoice.id,
          user_id: invoice.user_id,
          chase_stage: expectedStage,
          email_to: user.email,
          status: "check_in_sent",
        })
      }

      results.push({
        invoice_id: invoice.id,
        ref: invoice.ref,
        stage: expectedStage,
        type: "check_in_sent",
        success,
        error: success ? undefined : resendData.message,
      })

      // Small delay between sends to respect rate limits
      await new Promise((r) => setTimeout(r, 200))
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
