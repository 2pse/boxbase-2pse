import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegistrationCheckRequest {
  user_id: string;
  course_id: string;
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

    // Parse request body
    const body: RegistrationCheckRequest = await req.json();
    const { user_id, course_id } = body;

    if (!user_id || !course_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, course_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check course status first
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('max_participants, status, is_cancelled')
      .eq('id', course_id)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ canRegister: false, reason: 'Course not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (course.status !== 'active' || course.is_cancelled) {
      return new Response(
        JSON.stringify({ canRegister: false, reason: 'Course is not active or cancelled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count current registrations
    const { data: registrations, error: regError } = await supabase
      .from('course_registrations')
      .select('id')
      .eq('course_id', course_id)
      .eq('status', 'registered');

    if (regError) {
      console.error('Registration count error:', regError);
      return new Response(
        JSON.stringify({ canRegister: false, reason: 'Error checking registrations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentRegistrations = registrations?.length || 0;
    if (currentRegistrations >= course.max_participants) {
      return new Response(
        JSON.stringify({ canRegister: false, reason: 'Course is full', canWaitlist: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user membership in v2 system first
    const { data: membershipV2, error: v2Error } = await supabase
      .from('user_memberships_v2')
      .select(`
        *,
        membership_plans_v2!inner(booking_rules)
      `)
      .eq('user_id', user_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!v2Error && membershipV2) {
      const bookingRules = membershipV2.membership_plans_v2.booking_rules as any;
      const membershipData = membershipV2.membership_data as any || {};

      // Check membership type and permissions
      if (bookingRules.type === 'unlimited') {
        return new Response(
          JSON.stringify({ canRegister: true, membershipType: 'unlimited' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (bookingRules.type === 'open_gym_only') {
        return new Response(
          JSON.stringify({ canRegister: false, reason: 'Membership only allows Open Gym access' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (bookingRules.type === 'credits') {
        const remainingCredits = membershipData.remaining_credits || 0;
        return new Response(
          JSON.stringify({ 
            canRegister: remainingCredits > 0, 
            reason: remainingCredits > 0 ? null : 'No credits remaining',
            membershipType: 'credits',
            remainingCredits
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (bookingRules.type === 'limited') {
        const limit = bookingRules.limit;
        
        // Calculate period start based on limit type
        const now = new Date();
        let periodStart: Date;
        if (limit?.period === 'week') {
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - now.getDay() + 1); // Monday
        } else {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1); // First of month
        }

        // Count registrations in current period
        const { data: periodRegistrations, error: periodError } = await supabase
          .from('course_registrations')
          .select('id')
          .eq('user_id', user_id)
          .eq('status', 'registered')
          .gte('registered_at', periodStart.toISOString());

        if (periodError) {
          console.error('Period registration error:', periodError);
          return new Response(
            JSON.stringify({ canRegister: false, reason: 'Error checking period limits' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const usedInPeriod = periodRegistrations?.length || 0;
        const limitCount = limit?.count || 0;
        
        // For limited memberships, calculate credits dynamically like CreditsCounter
        const dynamicCredits = Math.max(0, limitCount - usedInPeriod);
        
        // Use dynamic credits for limited memberships (ignore membership_data.remaining_credits)
        const remainingCredits = dynamicCredits;
        const canRegister = remainingCredits > 0;

        // Provide specific reason for rejection
        let reason = null;
        if (!canRegister) {
          reason = `${limit?.period === 'week' ? 'Weekly' : 'Monthly'} limit reached (${usedInPeriod}/${limitCount} used)`;
        }

        console.log(`Limited membership check for user ${user_id}:`, {
          usedInPeriod,
          limitCount,
          dynamicCredits,
          canRegister,
          periodStart: periodStart.toISOString()
        });

        return new Response(
          JSON.stringify({ 
            canRegister, 
            reason,
            membershipType: 'limited',
            remainingCredits,
            usedInPeriod,
            periodLimit: limitCount
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fallback to v1 system and admin/trainer check
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id)
      .in('role', ['admin', 'trainer'])
      .maybeSingle();

    if (!roleError && userRole) {
      return new Response(
        JSON.stringify({ canRegister: true, membershipType: 'unlimited', reason: 'Admin/Trainer access' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check legacy v1 system
    const { data: membershipV1, error: v1Error } = await supabase
      .from('user_memberships')
      .select(`
        *,
        membership_plans!inner(booking_type, booking_limit)
      `)
      .eq('user_id', user_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!v1Error && membershipV1) {
      const plan = membershipV1.membership_plans;
      
      if (plan.booking_type === 'unlimited') {
        return new Response(
          JSON.stringify({ canRegister: true, membershipType: 'unlimited' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (plan.booking_type === 'credits') {
        const remainingCredits = membershipV1.remaining_credits || 0;
        return new Response(
          JSON.stringify({ 
            canRegister: remainingCredits > 0, 
            reason: remainingCredits > 0 ? null : 'No credits remaining',
            membershipType: 'credits',
            remainingCredits
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle monthly/weekly limits in v1 system
      if (plan.booking_type === 'monthly_limit' || plan.booking_type === 'weekly_limit') {
        const now = new Date();
        let periodStart: Date;
        if (plan.booking_type === 'weekly_limit') {
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - now.getDay() + 1);
        } else {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const { data: periodRegistrations, error: periodError } = await supabase
          .from('course_registrations')
          .select('id')
          .eq('user_id', user_id)
          .eq('status', 'registered')
          .gte('registered_at', periodStart.toISOString());

        if (periodError) {
          console.error('Period registration error:', periodError);
          return new Response(
            JSON.stringify({ canRegister: false, reason: 'Error checking period limits' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const usedInPeriod = periodRegistrations?.length || 0;
        const canRegister = usedInPeriod < (plan.booking_limit || 0);

        return new Response(
          JSON.stringify({ 
            canRegister, 
            reason: canRegister ? null : `${plan.booking_type === 'weekly_limit' ? 'Weekly' : 'Monthly'} limit reached`,
            membershipType: 'limited',
            usedInPeriod,
            periodLimit: plan.booking_limit || 0
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // No valid membership found
    return new Response(
      JSON.stringify({ canRegister: false, reason: 'No valid membership found' }),
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