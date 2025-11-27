import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateProductRequest {
  plan_id: string;
}

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

    // Verify admin
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

    // Check admin role
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!role) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { plan_id }: CreateProductRequest = await req.json();

    // Get plan details
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Create Stripe product
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description || undefined,
      metadata: {
        plan_id: plan.id,
        booking_type: plan.booking_rules?.type || "unknown",
      },
    });

    console.log("Created Stripe product:", product.id);

    // Create Stripe price
    const priceParams: Stripe.PriceCreateParams = {
      product: product.id,
      unit_amount: Math.round((plan.price_monthly || 0) * 100), // Convert to cents
      currency: "eur",
    };

    // Create recurring price if payment_frequency is monthly or yearly
    if (plan.payment_frequency === "monthly" || plan.payment_frequency === "yearly") {
      priceParams.recurring = {
        interval: plan.payment_frequency === "yearly" ? "year" : "month",
        interval_count: 1,
      };
    }

    const price = await stripe.prices.create(priceParams);
    console.log("Created Stripe price:", price.id);

    // Update plan with Stripe IDs
    const { error: updateError } = await supabase
      .from("membership_plans_v2")
      .update({
        stripe_product_id: product.id,
        stripe_price_id: price.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan_id);

    if (updateError) {
      console.error("Failed to update plan:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update plan with Stripe IDs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Create product error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
