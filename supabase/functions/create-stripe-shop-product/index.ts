import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateShopProductRequest {
  product_id: string;
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

    const { product_id }: CreateShopProductRequest = await req.json();

    // Get product details
    const { data: product, error: productError } = await supabase
      .from("shop_products")
      .select("*")
      .eq("id", product_id)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Create Stripe product
    const stripeProduct = await stripe.products.create({
      name: product.name,
      description: product.description || undefined,
      images: product.image_url ? [product.image_url] : undefined,
      metadata: {
        shop_product_id: product.id,
        category: product.category || "uncategorized",
      },
    });

    console.log("Created Stripe shop product:", stripeProduct.id);

    // Create Stripe price (always one-time for shop products)
    const price = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: Math.round(product.price * 100), // Convert to cents
      currency: "eur",
    });

    console.log("Created Stripe price:", price.id);

    // Update product with Stripe IDs
    const { error: updateError } = await supabase
      .from("shop_products")
      .update({
        stripe_product_id: stripeProduct.id,
        stripe_price_id: price.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product_id);

    if (updateError) {
      console.error("Failed to update product:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update product with Stripe IDs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        stripe_product_id: stripeProduct.id,
        stripe_price_id: price.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Create shop product error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
