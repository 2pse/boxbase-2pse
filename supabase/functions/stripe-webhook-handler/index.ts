import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      return new Response("Stripe not configured", { status: 500 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }
    } else {
      // For development/testing without signature verification
      event = JSON.parse(body);
      console.warn("⚠️ Webhook signature not verified - STRIPE_WEBHOOK_SECRET not configured");
    }

    console.log("Received Stripe event:", event.type, event.id);

    // Idempotency check
    const { data: existingEvent } = await supabase
      .from("processed_stripe_events")
      .select("id")
      .eq("event_id", event.id)
      .single();

    if (existingEvent) {
      console.log("Event already processed:", event.id);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Process different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    // Mark event as processed
    await supabase.from("processed_stripe_events").insert({
      event_id: event.id,
      event_type: event.type,
      metadata: { processed_at: new Date().toISOString() },
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(`Webhook Error: ${error.message}`, { status: 500 });
  }
});

async function handleCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const userId = metadata.user_id;
  const purchaseType = metadata.purchase_type;

  console.log("Processing checkout completed:", { userId, purchaseType, sessionId: session.id });

  if (!userId) {
    console.error("No user_id in session metadata");
    return;
  }

  // Update purchase history
  await supabase
    .from("purchase_history")
    .update({ 
      status: "completed",
      stripe_payment_intent_id: session.payment_intent as string,
      updated_at: new Date().toISOString()
    })
    .eq("stripe_session_id", session.id);

  if (purchaseType === "membership" || purchaseType === "credit_topup") {
    const planId = metadata.plan_id;
    const existingMembershipId = metadata.existing_membership_id;

    // Get plan details
    const { data: plan } = await supabase
      .from("membership_plans_v2")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan) {
      console.error("Plan not found:", planId);
      return;
    }

    if (purchaseType === "credit_topup" && existingMembershipId) {
      // Add credits to existing membership
      const { data: existingMembership } = await supabase
        .from("user_memberships_v2")
        .select("*, membership_plans_v2(*)")
        .eq("id", existingMembershipId)
        .single();

      if (existingMembership) {
        const currentCredits = existingMembership.membership_data?.remaining_credits || 0;
        const newCredits = plan.booking_rules?.limit?.count || 0;
        
        await supabase
          .from("user_memberships_v2")
          .update({
            membership_data: {
              ...existingMembership.membership_data,
              remaining_credits: currentCredits + newCredits,
              last_topup_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingMembershipId);

        console.log(`Added ${newCredits} credits to membership ${existingMembershipId}. Total: ${currentCredits + newCredits}`);
      }
    } else {
      // Create new membership
      const startDate = new Date().toISOString().split("T")[0];
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (plan.duration_months || 1));

      const membershipData: any = {};
      if (plan.booking_rules?.type === "credits") {
        membershipData.remaining_credits = plan.booking_rules?.limit?.count || 0;
        membershipData.credits_added_at = new Date().toISOString();
      }

      // Deactivate existing active memberships
      await supabase
        .from("user_memberships_v2")
        .update({ status: "superseded", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "active");

      // Create new membership
      await supabase.from("user_memberships_v2").insert({
        user_id: userId,
        membership_plan_id: planId,
        start_date: startDate,
        end_date: endDate.toISOString().split("T")[0],
        auto_renewal: plan.auto_renewal || false,
        status: "active",
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string || null,
        membership_data: membershipData,
      });

      console.log("Created new membership for user:", userId);
    }
  } else if (purchaseType === "product") {
    const productId = metadata.product_id;

    // Decrement stock
    const { data: product } = await supabase
      .from("shop_products")
      .select("stock_quantity")
      .eq("id", productId)
      .single();

    if (product) {
      await supabase
        .from("shop_products")
        .update({ 
          stock_quantity: Math.max(0, product.stock_quantity - 1),
          updated_at: new Date().toISOString()
        })
        .eq("id", productId);

      console.log("Decremented stock for product:", productId);
    }
  }
}

async function handleSubscriptionUpdated(supabase: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  const { data: membership } = await supabase
    .from("user_memberships_v2")
    .select("*")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (membership) {
    let newStatus = membership.status;
    
    if (subscription.status === "active") {
      newStatus = "active";
    } else if (subscription.status === "past_due") {
      newStatus = "payment_failed";
    } else if (subscription.status === "canceled") {
      newStatus = "cancelled";
    }

    await supabase
      .from("user_memberships_v2")
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", membership.id);

    console.log("Updated subscription status:", subscription.id, newStatus);
  }
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  await supabase
    .from("user_memberships_v2")
    .update({ 
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("stripe_subscription_id", subscription.id);

  console.log("Cancelled subscription:", subscription.id);
}

async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  
  if (subscriptionId) {
    await supabase
      .from("user_memberships_v2")
      .update({ 
        status: "payment_failed",
        updated_at: new Date().toISOString()
      })
      .eq("stripe_subscription_id", subscriptionId);

    console.log("Marked payment failed for subscription:", subscriptionId);
  }
}

async function handlePaymentSucceeded(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  
  if (subscriptionId && invoice.billing_reason === "subscription_cycle") {
    // Subscription renewal
    const { data: membership } = await supabase
      .from("user_memberships_v2")
      .select("*, membership_plans_v2(*)")
      .eq("stripe_subscription_id", subscriptionId)
      .single();

    if (membership) {
      // Extend end date
      const newEndDate = new Date(membership.end_date);
      newEndDate.setMonth(newEndDate.getMonth() + (membership.membership_plans_v2?.duration_months || 1));

      await supabase
        .from("user_memberships_v2")
        .update({
          status: "active",
          end_date: newEndDate.toISOString().split("T")[0],
          updated_at: new Date().toISOString()
        })
        .eq("id", membership.id);

      console.log("Extended membership end date:", membership.id);
    }
  }
}
