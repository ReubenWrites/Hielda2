// Supabase Edge Function: Create Stripe Customer Portal Session
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

    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 })
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user_id)
      .single()

    if (!sub?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "No Stripe customer found" }), { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${APP_URL}?view=billing`,
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
