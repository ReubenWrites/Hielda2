// Supabase Edge Function: Stripe Webhook Handler
// Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET as Supabase secrets

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0"
import Stripe from "https://esm.sh/stripe@14.14.0"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

serve(async (req) => {
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing signature", { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${e.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.subscription
          ? (await stripe.subscriptions.retrieve(session.subscription as string)).metadata.supabase_user_id
          : null

        if (userId && session.subscription) {
          const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string)

          await supabase
            .from("subscriptions")
            .update({
              stripe_subscription_id: stripeSubscription.id,
              stripe_customer_id: session.customer as string,
              status: "active",
              plan: "pro",
              current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.supabase_user_id

        if (userId) {
          await supabase
            .from("subscriptions")
            .update({
              status: subscription.status === "active" ? "active" : subscription.status === "past_due" ? "past_due" : subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.supabase_user_id

        if (userId) {
          await supabase
            .from("subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
          const userId = subscription.metadata.supabase_user_id

          if (userId) {
            await supabase
              .from("subscriptions")
              .update({
                status: "past_due",
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId)
          }
        }
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    console.error("Webhook handler error:", e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
