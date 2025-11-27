import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { plan_id, success_url, cancel_url } = await req.json();
    console.log("Upgrade checkout request:", { plan_id, user_id: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get target plan
    const { data: targetPlan, error: planError } = await supabase
      .from("membership_plans_v2")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !targetPlan) {
      return new Response(
        JSON.stringify({ error: "Plan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!targetPlan.stripe_price_id) {
      return new Response(
        JSON.stringify({ error: "Plan not linked to Stripe" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing pending upgrade and cancel it first
    const { data: pendingMembership } = await supabase
      .from("user_memberships_v2")
      .select("*, membership_plans_v2(*)")
      .eq("user_id", user.id)
      .eq("status", "pending_activation")
      .single();

    if (pendingMembership?.stripe_subscription_id) {
      console.log("Cancelling previous pending upgrade:", pendingMembership.stripe_subscription_id);
      
      // Cancel the pending Stripe subscription
      await stripe.subscriptions.cancel(pendingMembership.stripe_subscription_id);
      
      // Update the membership status to "cancelled"
      await supabase
        .from("user_memberships_v2")
        .update({ 
          status: "cancelled",
          membership_data: {
            ...((pendingMembership.membership_data as object) || {}),
            cancelled_reason: "replaced_by_new_upgrade",
            cancelled_at: new Date().toISOString()
          }
        })
        .eq("id", pendingMembership.id);
    }

    // Get current active membership with subscription
    const { data: currentMembership } = await supabase
      .from("user_memberships_v2")
      .select("*, membership_plans_v2(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .not("stripe_subscription_id", "is", null)
      .single();

    if (!currentMembership?.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: "No active subscription found to upgrade" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current Stripe subscription to find billing cycle end
    const currentSubscription = await stripe.subscriptions.retrieve(currentMembership.stripe_subscription_id);
    const nextBillingDate = currentSubscription.current_period_end;

    // Get or create customer
    let customerId = currentMembership.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }

    // Calculate billing start date (next billing cycle)
    const billingStartDate = new Date(nextBillingDate * 1000).toISOString().split('T')[0];

    // Create checkout session with deferred billing
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: targetPlan.stripe_price_id, quantity: 1 }],
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url,
      subscription_data: {
        billing_cycle_anchor: nextBillingDate,
        proration_behavior: "none",
        metadata: {
          user_id: user.id,
          old_subscription_id: currentMembership.stripe_subscription_id,
        },
      },
      metadata: {
        user_id: user.id,
        plan_id: plan_id,
        purchase_type: "membership_upgrade",
        old_membership_id: currentMembership.id,
        old_subscription_id: currentMembership.stripe_subscription_id,
        billing_start_date: billingStartDate,
        plan_duration_months: targetPlan.duration_months?.toString() || "0",
        item_name: targetPlan.name,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log("Created upgrade checkout session:", session.id);

    // Create pending purchase record
    await supabase.from("purchase_history").insert({
      user_id: user.id,
      stripe_session_id: session.id,
      amount: targetPlan.price_monthly || 0,
      currency: "eur",
      item_type: "membership",
      item_id: plan_id,
      item_name: targetPlan.name,
      status: "pending",
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Upgrade checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
