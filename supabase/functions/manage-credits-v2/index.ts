import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManageCreditsRequest {
  user_id: string;
  credits_to_add: number;
  action: 'add' | 'subtract' | 'set';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')!;
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || userRoles?.role !== 'admin') {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ManageCreditsRequest = await req.json();
    const { user_id, credits_to_add, action = 'add' } = body;

    if (!user_id || credits_to_add === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, credits_to_add' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's active membership from new v2 system
    const { data: membership, error: membershipError } = await supabase
      .from('user_memberships_v2')
      .select(`
        *,
        membership_plans_v2!inner(booking_rules)
      `)
      .eq('user_id', user_id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      console.error('Membership not found:', membershipError);
      return new Response(
        JSON.stringify({ error: 'No active membership found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if membership supports credits
    const bookingRules = membership.membership_plans_v2.booking_rules as any;
    if (bookingRules.type !== 'credits') {
      return new Response(
        JSON.stringify({ error: 'User membership does not support credit management' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current credits from membership_data
    const membershipData = membership.membership_data as any || {};
    const currentCredits = membershipData.remaining_credits || 0;

    // Calculate new credit amount based on action
    let newCredits: number;
    switch (action) {
      case 'add':
        newCredits = currentCredits + credits_to_add;
        break;
      case 'subtract':
        newCredits = Math.max(0, currentCredits - credits_to_add);
        break;
      case 'set':
        newCredits = Math.max(0, credits_to_add);
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use "add", "subtract", or "set"' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Update membership data with new credits
    const updatedMembershipData = {
      ...membershipData,
      remaining_credits: newCredits,
      last_credit_update: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('user_memberships_v2')
      .update({ 
        membership_data: updatedMembershipData,
        updated_at: new Date().toISOString()
      })
      .eq('id', membership.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update credits: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the credit change for audit purposes
    console.log(`Credit ${action} for user ${user_id}: ${currentCredits} -> ${newCredits} (${action === 'add' ? '+' : action === 'subtract' ? '-' : '='}${credits_to_add})`);

    return new Response(
      JSON.stringify({
        success: true,
        previous_credits: currentCredits,
        new_credits: newCredits,
        action: action,
        amount: credits_to_add
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});