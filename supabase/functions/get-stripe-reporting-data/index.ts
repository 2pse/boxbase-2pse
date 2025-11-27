import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-REPORTING] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // 1. Validate Stripe Key
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // 2. Supabase Client for Auth
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 3. Authenticate user (only logged-in users)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // 4. Initialize Stripe Client
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // 5. Calculate time range (last 12 months)
    const now = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(now.getMonth() - 12);

    // ============ FETCH INVOICES ============
    logStep("Fetching paid invoices (last 12 months)");
    const invoices = await stripe.invoices.list({
      status: 'paid',
      created: {
        gte: Math.floor(twelveMonthsAgo.getTime() / 1000),
      },
      limit: 100,
    });
    logStep("Invoices fetched", { count: invoices.data.length });

    // 6. Aggregate invoices by month
    const monthlyRevenue: { [key: string]: number } = {};
    let totalRevenue = 0;

    invoices.data.forEach(invoice => {
      const date = new Date(invoice.created * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = invoice.amount_paid / 100; // Cents → Euro
      
      if (!monthlyRevenue[monthKey]) {
        monthlyRevenue[monthKey] = 0;
      }
      monthlyRevenue[monthKey] += amount;
      totalRevenue += amount;
    });

    // ============ FETCH SUBSCRIPTIONS ============
    logStep("Fetching active subscriptions");
    const subscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
    });
    
    // IMPORTANT: Only subscriptions with valid items
    const validSubscriptions = subscriptions.data.filter(sub => 
      sub.items && sub.items.data && sub.items.data.length > 0
    );
    
    logStep("Active subscriptions fetched", { 
      total: subscriptions.data.length,
      valid: validSubscriptions.length 
    });

    // ============ CALCULATE MRR ============
    let mrr = 0;
    const subscriptionsByProduct: { [key: string]: { count: number, revenue: number, name: string } } = {};

    for (const sub of validSubscriptions) {
      for (const item of sub.items.data) {
        const price = item.price;
        let monthlyAmount = 0;

        // Normalize interval to monthly
        if (price.recurring?.interval === 'month') {
          monthlyAmount = (price.unit_amount || 0) / 100;
        } else if (price.recurring?.interval === 'year') {
          monthlyAmount = (price.unit_amount || 0) / 100 / 12;
        }

        mrr += monthlyAmount * (item.quantity || 1);

        // Group by product
        const productId = typeof price.product === 'string' 
          ? price.product 
          : price.product?.id || 'unknown';
        
        if (!subscriptionsByProduct[productId]) {
          try {
            const product = await stripe.products.retrieve(productId);
            subscriptionsByProduct[productId] = {
              count: 0,
              revenue: 0,
              name: product.name,
            };
          } catch (error) {
            subscriptionsByProduct[productId] = {
              count: 0,
              revenue: 0,
              name: 'Unknown Product',
            };
          }
        }

        subscriptionsByProduct[productId].count += (item.quantity || 1);
        subscriptionsByProduct[productId].revenue += monthlyAmount * (item.quantity || 1);
      }
    }

    logStep("MRR calculated", { mrr, productCount: Object.keys(subscriptionsByProduct).length });

    // ============ CALCULATE CHURN RATE ============
    const lastMonth = new Date();
    lastMonth.setMonth(now.getMonth() - 1);
    const lastMonthStart = Math.floor(new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).getTime() / 1000);
    const lastMonthEnd = Math.floor(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getTime() / 1000);

    const allCanceledSubs = await stripe.subscriptions.list({
      status: 'canceled',
      limit: 100,
    });
    
    // Filter: Only canceled in the last month
    const canceledLastMonth = allCanceledSubs.data.filter(sub => {
      const canceledAt = sub.canceled_at;
      return canceledAt && canceledAt >= lastMonthStart && canceledAt <= lastMonthEnd;
    });

    const churnRate = validSubscriptions.length > 0 
      ? (canceledLastMonth.length / (validSubscriptions.length + canceledLastMonth.length)) * 100 
      : 0;

    logStep("Churn rate calculated", { churnRate, canceledCount: canceledLastMonth.length });

    // ============ CALCULATE GROWTH RATE ============
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    
    const currentMonthRevenue = monthlyRevenue[currentMonthKey] || 0;
    const lastMonthRevenue = monthlyRevenue[lastMonthKey] || 0;
    
    const growthRate = lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;

    logStep("Growth rate calculated", { growthRate, currentMonthRevenue, lastMonthRevenue });

    // ============ CALCULATE ARPU ============
    const arpu = validSubscriptions.length > 0 ? mrr / validSubscriptions.length : 0;

    // ============ FORMAT RESPONSE ============
    const monthlyRevenueChart = Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, revenue]) => {
        const date = new Date(month + '-01');
        return {
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          total: revenue,
        };
      });

    const subscriptionBreakdown = Object.entries(subscriptionsByProduct).map(([productId, data]) => ({
      product_id: productId,
      name: data.name,
      count: data.count,
      mrr: data.revenue,
    }));

    const responseData = {
      metrics: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        activeSubscriptions: validSubscriptions.length,
        mrr: parseFloat(mrr.toFixed(2)),
        churnRate: parseFloat(churnRate.toFixed(2)),
        growthRate: parseFloat(growthRate.toFixed(2)),
        arpu: parseFloat(arpu.toFixed(2)),
      },
      monthlyRevenue: monthlyRevenueChart,
      subscriptionBreakdown,
    };

    logStep("Response prepared", { metricsCount: Object.keys(responseData.metrics).length });

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in get-stripe-reporting-data", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
