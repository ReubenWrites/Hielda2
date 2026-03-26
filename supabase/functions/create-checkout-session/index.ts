// Supabase Edge Function: Create Stripe Checkout Session
// Requires STRIPE_SECRET_KEY as a Supabase secret

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0"
import Stripe from "https://esm.sh/stripe@14.14.0"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const APP_URL = Deno.env.get("APP_URL") || "https://hielda.com"

serve(async (req) => {
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
      .select("stripe_customer_id")
      .eq("user_id", user_id)
      .single()

    let customerId = sub?.stripe_customer_id

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
      success_url: `${APP_URL}?billing=success`,
      cancel_url: `${APP_URL}?billing=canceled`,
      subscription_data: {
        metadata: { supabase_user_id: user_id },
      },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
