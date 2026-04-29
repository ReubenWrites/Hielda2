// Supabase Edge Function: Create Stripe Checkout Session
// Requires STRIPE_SECRET_KEY as a Supabase secret

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0"
import Stripe from "https://esm.sh/stripe@14.14.0"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const APP_URL = Deno.env.get("APP_URL") || "https://hielda.com"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { price_id, user_id } = await req.json()

    if (!price_id || !user_id) {
      return new Response(JSON.stringify({ error: "price_id and user_id required" }), { status: 400 })
    }

    // Get user profile for email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user_id)
      .single()

    // Check if user already has a Stripe customer
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user_id)
      .single()

    let customerId = sub?.stripe_customer_id

    // Defence in depth against duplicate checkout: if the customer already
    // has a live Stripe subscription, refuse to start a second one. Without
    // this guard a stale tab / back button / accidental double-click can
    // create a parallel subscription on the same customer and bill twice —
    // our DB would only ever see the latest stripe_subscription_id so the
    // duplicate would be invisible from inside the app.
    if (customerId) {
      try {
        const existing = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 10,
        })
        const liveStatuses = new Set(["active", "trialing", "past_due", "unpaid"])
        if (existing.data.some(s => liveStatuses.has(s.status))) {
          return new Response(JSON.stringify({
            error: "You already have an active subscription. Use the billing portal to manage it.",
            code: "already_subscribed",
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
      } catch {
        // If the lookup itself fails (network blip etc), fall through and
        // allow checkout — better to occasionally let a real signup proceed
        // than to permanently block legitimate retries on Stripe outages.
      }
    }

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email,
        name: profile?.full_name,
        metadata: { supabase_user_id: user_id },
      })
      customerId = customer.id

      // Save customer ID
      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user_id)
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: price_id, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${APP_URL}?billing=success`,
      cancel_url: `${APP_URL}?billing=canceled`,
      subscription_data: {
        metadata: { supabase_user_id: user_id },
      },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
