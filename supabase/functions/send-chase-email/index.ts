// Supabase Edge Function: Send a chase email via Resend
// Requires RESEND_API_KEY and SUPABASE_SERVICE_ROLE_KEY as secrets

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const RATE = 11.75
const DAILY_RATE = RATE / 365 / 100

function penalty(amount: number): number {
  if (amount < 1000) return 40
  if (amount < 10000) return 70
  return 100
}

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function daysLate(due: string): number {
  const d = Math.floor((Date.now() - new Date(due).getTime()) / 864e5)
  return d > 0 ? d : 0
}

serve(async (req) => {
  try {
    const { invoice_id, chase_stage } = await req.json()

    if (!invoice_id || !chase_stage) {
      return new Response(JSON.stringify({ error: "invoice_id and chase_stage required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .single()

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404 })
    }

    // Fetch profile
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", invoice.user_id)
      .single()

    if (profErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404 })
    }

    if (!invoice.client_email) {
      return new Response(JSON.stringify({ error: "No client email on invoice" }), { status: 400 })
    }

    // Build email content
    const dl = daysLate(invoice.due_date)
    const interest = Number(invoice.amount) * DAILY_RATE * dl
    const pen = penalty(Number(invoice.amount))
    const total = Number(invoice.amount) + interest + pen
    const fromName = profile.business_name || profile.full_name || "Hielda"

    const emailContent = buildEmailContent(invoice, profile, chase_stage, dl, interest, pen, total, fromName)

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} via Hielda <chase@hielda.com>`,
        to: [invoice.client_email],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      throw new Error(resendData.message || "Resend API error")
    }

    // Log the send
    await supabase.from("chase_log").insert({
      invoice_id,
      user_id: invoice.user_id,
      chase_stage,
      email_to: invoice.client_email,
      status: "sent",
    })

    // Update invoice chase stage
    await supabase
      .from("invoices")
      .update({ chase_stage })
      .eq("id", invoice_id)

    return new Response(JSON.stringify({ success: true, resend_id: resendData.id }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

function buildEmailContent(
  invoice: any, profile: any, stage: string,
  dl: number, interest: number, pen: number, total: number, fromName: string
) {
  const payBlock = `
    <div style="background:#f1f3f6;padding:14px 18px;border-radius:8px;margin:16px 0;font-size:13px;">
      <div style="font-weight:600;color:#0f172a;margin-bottom:6px;">Payment Details</div>
      <div style="color:#64748b;">
        Bank: ${profile.bank_name || "—"}<br/>
        Sort Code: ${profile.sort_code || "—"}<br/>
        Account: ${profile.account_number || "—"}<br/>
        Reference: ${invoice.ref}
      </div>
    </div>`

  const subjects: Record<string, string> = {
    reminder_1: `Payment reminder: Invoice ${invoice.ref} — ${fmt(invoice.amount)}`,
    reminder_2: `Upcoming: Invoice ${invoice.ref} due tomorrow — ${fmt(invoice.amount)}`,
    first_chase: `OVERDUE: Invoice ${invoice.ref} — payment required`,
    second_chase: `OVERDUE: Invoice ${invoice.ref} — ${fmt(total)} now owed`,
    final_notice: `FINAL NOTICE: Invoice ${invoice.ref} — ${fmt(total)} overdue`,
  }

  const bodies: Record<string, string> = {
    reminder_1: `<p>Dear ${invoice.client_name},</p><p>This is a friendly reminder that invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due by <strong>${formatDate(invoice.due_date)}</strong>.</p><p>Please ensure payment is made by the due date.</p>${payBlock}<p>Kind regards,<br/>${fromName}</p>`,
    reminder_2: `<p>Dear ${invoice.client_name},</p><p>Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> is due <strong>tomorrow</strong>. Late payment charges will apply under the Late Payment of Commercial Debts (Interest) Act 1998.</p>${payBlock}<p>Kind regards,<br/>${fromName}</p>`,
    first_chase: `<p>Dear ${invoice.client_name},</p><p>Invoice <strong>${invoice.ref}</strong> for <strong>${fmt(invoice.amount)}</strong> was due by <strong>${formatDate(invoice.due_date)}</strong> and remains unpaid. Interest at ${RATE}% p.a. is now accruing.</p><p>Please arrange payment immediately.</p>${payBlock}<p>Regards,<br/>${fromName}</p>`,
    second_chase: `<p>Dear ${invoice.client_name},</p><p>Invoice <strong>${invoice.ref}</strong> is <strong>${dl} days overdue</strong>. Charges applied: Penalty ${fmt(pen)} + Interest ${fmt(interest)}. <strong>Total now owed: ${fmt(total)}</strong></p><p>Please settle immediately.</p>${payBlock}<p>Regards,<br/>${fromName}</p>`,
    final_notice: `<p>Dear ${invoice.client_name},</p><p><strong>FINAL NOTICE.</strong> Invoice ${invoice.ref} is ${dl} days overdue. Total owed: <strong>${fmt(total)}</strong>. If not paid within 7 days, we will pursue formal debt recovery.</p>${payBlock}<p>Regards,<br/>${fromName}</p>`,
  }

  const stageColors: Record<string, string> = {
    reminder_1: "#1e5fa0", reminder_2: "#2d72b8", first_chase: "#d97706",
    second_chase: "#c2410c", final_notice: "#9f1239",
  }

  const body = bodies[stage] || bodies.first_chase
  const subject = subjects[stage] || subjects.first_chase
  const color = stageColors[stage] || "#1e5fa0"

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
    <body style="margin:0;padding:0;background:#f1f3f6;font-family:system-ui,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#fff;border-radius:12px;border:1px solid #dce1e8;overflow:hidden;">
          <div style="background:${color};padding:16px 24px;"><div style="color:#fff;font-weight:700;font-size:14px;">Hielda</div></div>
          <div style="padding:28px 24px;font-size:14px;line-height:1.7;color:#0f172a;">${body}</div>
        </div>
        <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">Sent via Hielda — Protecting your pay.</div>
      </div>
    </body></html>`

  return { subject, html }
}
