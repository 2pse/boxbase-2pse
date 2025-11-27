import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User requesting cancellation:', user.id);

    // Get user's active membership
    const { data: membership, error: membershipError } = await supabaseClient
      .from('user_memberships_v2')
      .select('*, membership_plans_v2(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      console.error('Membership error:', membershipError);
      return new Response(
        JSON.stringify({ error: 'No active membership found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found membership:', membership.id, 'Plan:', membership.membership_plans_v2?.name);

    // Check if cancellation is allowed for this plan
    const plan = membership.membership_plans_v2;
    if (!plan?.cancellation_allowed) {
      return new Response(
        JSON.stringify({ error: 'Cancellation is not allowed for this membership plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already cancelled
    const membershipData = membership.membership_data || {};
    if (membershipData.cancellation_requested_at) {
      return new Response(
        JSON.stringify({ error: 'Membership is already scheduled for cancellation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // If there's a Stripe subscription, cancel it at period end
    if (membership.stripe_subscription_id) {
      console.log('Cancelling Stripe subscription:', membership.stripe_subscription_id);
      
      try {
        await stripe.subscriptions.update(membership.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        console.log('Stripe subscription set to cancel at period end');
      } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        return new Response(
          JSON.stringify({ error: 'Failed to cancel Stripe subscription' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update membership_data to track cancellation
    const updatedMembershipData = {
      ...membershipData,
      cancellation_requested_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseClient
      .from('user_memberships_v2')
      .update({
        membership_data: updatedMembershipData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update membership' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Membership cancellation recorded for user:', user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Membership scheduled for cancellation',
        end_date: membership.end_date,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cancel-membership:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
