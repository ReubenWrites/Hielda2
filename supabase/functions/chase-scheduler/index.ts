// Supabase Edge Function: Daily chase scheduler
// Called by pg_cron daily at 9am UTC
// Checks all overdue invoices and sends appropriate chase emails

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const CHASE_STAGES = [
  { id: "reminder_1", dfd: -5 },
  { id: "reminder_2", dfd: -1 },
  { id: "first_chase", dfd: 1 },
  { id: "second_chase", dfd: 14 },
  { id: "final_notice", dfd: 30 },
]

function getExpectedStage(daysFromDue: number): string | null {
  // Walk stages in reverse to find the latest applicable stage
  for (let i = CHASE_STAGES.length - 1; i >= 0; i--) {
    if (daysFromDue >= CHASE_STAGES[i].dfd) return CHASE_STAGES[i].id
  }
  return null
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

      // Check if we already sent this stage
      const { data: logs } = await supabase
        .from("chase_log")
        .select("id")
        .eq("invoice_id", invoice.id)
        .eq("chase_stage", expectedStage)
        .limit(1)

      if (logs && logs.length > 0) continue // Already sent

      // Send the chase email via the send-chase-email function
      const { data: sendResult, error: sendErr } = await supabase.functions.invoke(
        "send-chase-email",
        { body: { invoice_id: invoice.id, chase_stage: expectedStage } }
      )

      results.push({
        invoice_id: invoice.id,
        ref: invoice.ref,
        stage: expectedStage,
        success: !sendErr,
        error: sendErr?.message,
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
