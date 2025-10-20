import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Open Gym check-in request from user: ${user.id}`);

    // Get user's active membership from v2 system
    const { data: membershipV2, error: v2Error } = await supabase
      .from('user_memberships_v2')
      .select(`
        *,
        membership_plans_v2!inner(booking_rules, name)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!v2Error && membershipV2) {
      const bookingRules = membershipV2.membership_plans_v2.booking_rules as any;
      const membershipData = membershipV2.membership_data as any || {};
      const planName = membershipV2.membership_plans_v2.name;

      console.log(`V2 Membership found: ${planName}, type: ${bookingRules.type}`);

      // Unlimited and open_gym_only memberships don't require credit deduction
      if (bookingRules.type === 'unlimited' || bookingRules.type === 'open_gym_only') {
        console.log('Unlimited/Open Gym membership - no credit deduction needed');
        
        // Mark user as active
        await supabase.rpc('mark_user_as_active', { user_id_param: user.id });
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Check-in successful',
            membershipType: bookingRules.type,
            creditsDeducted: false
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Limited memberships: Each Open Gym check-in counts towards period limit
      if (bookingRules.type === 'limited') {
        console.log('Limited membership - Open Gym check-in counts towards period limit');
        
        // Create a training session to track this Open Gym visit
        const { error: sessionError } = await supabase
          .from('training_sessions')
          .upsert({
            user_id: user.id,
            session_date: new Date().toISOString().split('T')[0],
            session_type: 'free_training',
            status: 'completed'
          }, {
            onConflict: 'user_id,session_date,session_type',
            ignoreDuplicates: true
          });

        if (sessionError) {
          console.error('Training session creation error:', sessionError);
        }
        
        // Mark user as active
        await supabase.rpc('mark_user_as_active', { user_id_param: user.id });
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Check-in successful. This visit counts towards your period limit.',
            membershipType: 'limited',
            creditsDeducted: false,
            sessionTracked: !sessionError
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For credits memberships, deduct 1 credit
      if (bookingRules.type === 'credits') {
        const currentCredits = membershipData.remaining_credits || 0;
        
        if (currentCredits <= 0) {
          console.log('No credits available for Open Gym check-in');
          return new Response(
            JSON.stringify({
              success: false,
              error: 'No credits available. Please top up your credits at reception.',
              remainingCredits: 0
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Deduct 1 credit
        const newCredits = currentCredits - 1;
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
          .eq('id', membershipV2.id);

        if (updateError) {
          console.error('Credit deduction error:', updateError);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Failed to deduct credit',
              details: updateError.message
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Credit deducted for Open Gym: ${currentCredits} -> ${newCredits}`);
        
        // Mark user as active
        await supabase.rpc('mark_user_as_active', { user_id_param: user.id });
        
        return new Response(
          JSON.stringify({
            success: true,
            message: `Check-in successful. 1 credit deducted.`,
            membershipType: 'credits',
            creditsDeducted: true,
            previousCredits: currentCredits,
            remainingCredits: newCredits
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if user has admin/trainer role (unlimited access)
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'trainer'])
      .maybeSingle();

    if (!roleError && userRole) {
      console.log(`Admin/Trainer check-in - no credit deduction needed`);
      
      // Mark user as active
      await supabase.rpc('mark_user_as_active', { user_id_param: user.id });
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Check-in successful',
          membershipType: 'admin_trainer',
          creditsDeducted: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No valid membership found
    console.log('No valid membership found for Open Gym check-in');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'No valid membership found. Please contact reception.'
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
