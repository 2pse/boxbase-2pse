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

    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Verify session belongs to user
    if (session.metadata?.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get membership details if applicable
    let membershipData = null;
    const purchaseType = session.metadata?.purchase_type;
    
    if (purchaseType === "membership" || purchaseType === "membership_upgrade" || purchaseType === "credits_to_subscription") {
      const { data: membership } = await supabase
        .from("user_memberships_v2")
        .select("*, membership_plans_v2(*)")
        .eq("user_id", user.id)
        .in("status", ["active", "pending_activation"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (membership) {
        membershipData = {
          planName: membership.membership_plans_v2?.name,
          startDate: membership.start_date,
          endDate: membership.end_date,
          status: membership.status,
        };
      }
    }

    return new Response(
      JSON.stringify({
        success: session.payment_status === "paid",
        status: session.payment_status,
        metadata: session.metadata,
        membership: membershipData,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Verify session error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
