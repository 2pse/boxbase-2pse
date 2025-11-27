import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  plan_id?: string;
  product_id?: string;
  success_url: string;
  cancel_url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not configured");
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

    const { plan_id, product_id, success_url, cancel_url }: CheckoutRequest = await req.json();
    console.log("Checkout request:", { plan_id, product_id, user_id: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get or create Stripe customer
    let customerId: string;
    const { data: existingMembership } = await supabase
      .from("user_memberships_v2")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .single();

    if (existingMembership?.stripe_customer_id) {
      customerId = existingMembership.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }

    // Handle membership plan checkout
    if (plan_id) {
      const { data: plan, error: planError } = await supabase
        .from("membership_plans_v2")
        .select("*")
        .eq("id", plan_id)
        .single();

      if (planError || !plan) {
        return new Response(
          JSON.stringify({ error: "Plan not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!plan.stripe_price_id) {
        return new Response(
          JSON.stringify({ error: "Plan not linked to Stripe" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user has existing credit membership (for top-up)
      const { data: activeMembership } = await supabase
        .from("user_memberships_v2")
        .select("*, membership_plans_v2(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      const isCreditsTopUp = activeMembership?.membership_plans_v2?.booking_rules?.type === "credits" 
        && plan.booking_rules?.type === "credits";

      const mode = plan.payment_type === "subscription" ? "subscription" : "payment";

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        payment_method_types: ["card"],
        mode: mode as Stripe.Checkout.SessionCreateParams.Mode,
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        success_url: success_url,
        cancel_url: cancel_url,
        metadata: {
          user_id: user.id,
          plan_id: plan_id,
          purchase_type: isCreditsTopUp ? "credit_topup" : "membership",
          existing_membership_id: activeMembership?.id || "",
        },
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      console.log("Created checkout session:", session.id);

      // Create pending purchase record
      await supabase.from("purchase_history").insert({
        user_id: user.id,
        stripe_session_id: session.id,
        amount: plan.price_monthly || 0,
        currency: "eur",
        item_type: isCreditsTopUp ? "credit_topup" : "membership",
        item_id: plan_id,
        item_name: plan.name,
        status: "pending",
      });

      return new Response(
        JSON.stringify({ url: session.url, session_id: session.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle shop product checkout
    if (product_id) {
      const { data: product, error: productError } = await supabase
        .from("shop_products")
        .select("*")
        .eq("id", product_id)
        .eq("is_active", true)
        .single();

      if (productError || !product) {
        return new Response(
          JSON.stringify({ error: "Product not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (product.stock_quantity <= 0) {
        return new Response(
          JSON.stringify({ error: "Product out of stock" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!product.stripe_price_id) {
        return new Response(
          JSON.stringify({ error: "Product not linked to Stripe" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [{ price: product.stripe_price_id, quantity: 1 }],
        success_url: success_url,
        cancel_url: cancel_url,
        metadata: {
          user_id: user.id,
          product_id: product_id,
          purchase_type: "product",
        },
      });

      console.log("Created product checkout session:", session.id);

      // Create pending purchase record
      await supabase.from("purchase_history").insert({
        user_id: user.id,
        stripe_session_id: session.id,
        amount: product.price,
        currency: "eur",
        item_type: "product",
        item_id: product_id,
        item_name: product.name,
        status: "pending",
      });

      return new Response(
        JSON.stringify({ url: session.url, session_id: session.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Either plan_id or product_id required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
