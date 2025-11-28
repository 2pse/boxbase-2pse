import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MemberActivity {
  user_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  membership_type: string;
  created_at: string;
  last_activity_date: string | null;
  days_since_signup: number;
  days_since_last_activity: number | null;
  total_bookings: number;
  total_training_sessions: number;
  cancellations: number;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    console.log(`[Risk Radar] Starting snapshot calculation for ${today}`);

    // 1. Load admin user IDs to exclude
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);
    console.log(`[Risk Radar] Excluding ${adminUserIds.size} admin users`);

    // 2. Load all profiles
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, first_name, last_name, created_at');

    // 3. Filter out admins in JavaScript
    const profiles = allProfiles?.filter(p => !adminUserIds.has(p.user_id)) || [];
    console.log(`[Risk Radar] Processing ${profiles.length} member profiles`);

    // 4. Load active memberships and plans separately
    const { data: memberships } = await supabase
      .from('user_memberships_v2')
      .select('user_id, membership_plan_id')
      .eq('status', 'active');

    const { data: plans } = await supabase
      .from('membership_plans_v2')
      .select('id, name')
      .eq('is_active', true);

    // Create plan map (plan_id → name)
    const planMap = new Map<string, string>();
    plans?.forEach(p => planMap.set(p.id, p.name));

    // Create membership map (user_id → plan name)
    const membershipMap = new Map<string, string>();
    memberships?.forEach(m => {
      const planName = planMap.get(m.membership_plan_id);
      if (planName) membershipMap.set(m.user_id, planName);
    });

    const memberActivities: MemberActivity[] = [];

    // 5. Calculate activity metrics for each member
    for (const profile of profiles) {
      // Get last course booking
      const { data: lastBooking } = await supabase
        .from('course_registrations')
        .select('registered_at')
        .eq('user_id', profile.user_id)
        .eq('status', 'registered')
        .order('registered_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get last Open Gym training (session_type = 'free_training')
      const { data: lastTraining } = await supabase
        .from('training_sessions')
        .select('session_date')
        .eq('user_id', profile.user_id)
        .eq('session_type', 'free_training')
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Determine last activity date (most recent of booking or training)
      const lastBookingDate = lastBooking?.registered_at ? new Date(lastBooking.registered_at) : null;
      const lastTrainingDate = lastTraining?.session_date ? new Date(lastTraining.session_date) : null;
      
      let lastActivityDate: Date | null = null;
      if (lastBookingDate && lastTrainingDate) {
        lastActivityDate = lastBookingDate > lastTrainingDate ? lastBookingDate : lastTrainingDate;
      } else {
        lastActivityDate = lastBookingDate || lastTrainingDate;
      }

      // Count total bookings
      const { count: bookingsCount } = await supabase
        .from('course_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.user_id)
        .eq('status', 'registered');

      // Count total trainings (Open Gym)
      const { count: trainingsCount } = await supabase
        .from('training_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.user_id)
        .eq('session_type', 'free_training');

      // Count cancellations
      const { count: cancellationsCount } = await supabase
        .from('course_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.user_id)
        .eq('status', 'cancelled');

      // Calculate days
      const signupDate = new Date(profile.created_at);
      const now = new Date();
      const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let daysSinceLastActivity: number | null = null;
      if (lastActivityDate) {
        daysSinceLastActivity = Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      memberActivities.push({
        user_id: profile.user_id,
        display_name: profile.display_name || 'Unknown',
        first_name: profile.first_name,
        last_name: profile.last_name,
        membership_type: membershipMap.get(profile.user_id) || 'No Membership',
        created_at: profile.created_at,
        last_activity_date: lastActivityDate?.toISOString().split('T')[0] || null,
        days_since_signup: daysSinceSignup,
        days_since_last_activity: daysSinceLastActivity,
        total_bookings: bookingsCount || 0,
        total_training_sessions: trainingsCount || 0,
        cancellations: cancellationsCount || 0,
      });
    }

    // 6. Categorize "Never Active" members
    const neverActive = memberActivities.filter(
      m => m.last_activity_date === null && m.total_bookings === 0 && m.total_training_sessions === 0
    );

    const neverActiveCounts = {
      '0-7': neverActive.filter(m => m.days_since_signup <= 7).length,
      '8-14': neverActive.filter(m => m.days_since_signup > 7 && m.days_since_signup <= 14).length,
      '15-21': neverActive.filter(m => m.days_since_signup > 14 && m.days_since_signup <= 21).length,
      '21+': neverActive.filter(m => m.days_since_signup > 21).length,
    };

    console.log(`[Risk Radar] Never Active: ${neverActive.length} total`, neverActiveCounts);

    // Insert/upsert never active snapshot
    await supabase.from('never_active_snapshots').upsert({
      snapshot_date: today,
      total_never_active: neverActive.length,
      days_0_7_count: neverActiveCounts['0-7'],
      days_8_14_count: neverActiveCounts['8-14'],
      days_15_21_count: neverActiveCounts['15-21'],
      days_21_plus_count: neverActiveCounts['21+'],
      days_0_7_percentage: neverActive.length > 0 ? (neverActiveCounts['0-7'] / neverActive.length * 100) : 0,
      days_8_14_percentage: neverActive.length > 0 ? (neverActiveCounts['8-14'] / neverActive.length * 100) : 0,
      days_15_21_percentage: neverActive.length > 0 ? (neverActiveCounts['15-21'] / neverActive.length * 100) : 0,
      days_21_plus_percentage: neverActive.length > 0 ? (neverActiveCounts['21+'] / neverActive.length * 100) : 0,
    }, { onConflict: 'snapshot_date' });

    // Delete old never active member details for today (to refresh)
    await supabase
      .from('never_active_member_details')
      .delete()
      .eq('snapshot_date', today);

    // Insert never active member details
    for (const member of neverActive) {
      let category: string;
      if (member.days_since_signup <= 7) category = '0-7';
      else if (member.days_since_signup <= 14) category = '8-14';
      else if (member.days_since_signup <= 21) category = '15-21';
      else category = '21+';

      await supabase.from('never_active_member_details').upsert({
        user_id: member.user_id,
        snapshot_date: today,
        days_since_signup: member.days_since_signup,
        category,
        display_name: member.display_name,
        first_name: member.first_name,
        last_name: member.last_name,
        membership_type: member.membership_type,
        signup_date: member.created_at.split('T')[0],
      }, { onConflict: 'user_id,snapshot_date' });
    }

    // 7. Categorize "Previously Active" members
    const previouslyActive = memberActivities.filter(m => m.last_activity_date !== null);

    const inactiveCounts = {
      'active': previouslyActive.filter(m => m.days_since_last_activity! < 10).length,
      '10-15': previouslyActive.filter(m => m.days_since_last_activity! >= 10 && m.days_since_last_activity! <= 15).length,
      '15-21': previouslyActive.filter(m => m.days_since_last_activity! > 15 && m.days_since_last_activity! <= 21).length,
      '21+': previouslyActive.filter(m => m.days_since_last_activity! > 21).length,
    };

    console.log(`[Risk Radar] Previously Active: ${previouslyActive.length} total`, inactiveCounts);

    // Insert/upsert inactive member snapshot
    await supabase.from('inactive_member_snapshots').upsert({
      snapshot_date: today,
      total_previously_active: previouslyActive.length,
      active_under_10_count: inactiveCounts['active'],
      days_10_15_count: inactiveCounts['10-15'],
      days_15_21_count: inactiveCounts['15-21'],
      days_21_plus_count: inactiveCounts['21+'],
      active_under_10_percentage: previouslyActive.length > 0 ? (inactiveCounts['active'] / previouslyActive.length * 100) : 0,
      days_10_15_percentage: previouslyActive.length > 0 ? (inactiveCounts['10-15'] / previouslyActive.length * 100) : 0,
      days_15_21_percentage: previouslyActive.length > 0 ? (inactiveCounts['15-21'] / previouslyActive.length * 100) : 0,
      days_21_plus_percentage: previouslyActive.length > 0 ? (inactiveCounts['21+'] / previouslyActive.length * 100) : 0,
    }, { onConflict: 'snapshot_date' });

    // Delete old inactive member details for today (to refresh)
    await supabase
      .from('inactive_member_details')
      .delete()
      .eq('snapshot_date', today);

    // Insert inactive member details
    for (const member of previouslyActive) {
      let category: string;
      if (member.days_since_last_activity! < 10) category = 'active';
      else if (member.days_since_last_activity! <= 15) category = '10-15';
      else if (member.days_since_last_activity! <= 21) category = '15-21';
      else category = '21+';

      await supabase.from('inactive_member_details').upsert({
        user_id: member.user_id,
        snapshot_date: today,
        days_since_last_activity: member.days_since_last_activity!,
        category,
        display_name: member.display_name,
        first_name: member.first_name,
        last_name: member.last_name,
        membership_type: member.membership_type,
        last_activity_date: member.last_activity_date,
        total_bookings: member.total_bookings,
        total_training_sessions: member.total_training_sessions,
        cancellations: member.cancellations,
      }, { onConflict: 'user_id,snapshot_date' });
    }

    console.log(`[Risk Radar] Snapshot calculation complete for ${today}`);

    return new Response(JSON.stringify({
      success: true,
      snapshot_date: today,
      never_active: { total: neverActive.length, categories: neverActiveCounts },
      previously_active: { total: previouslyActive.length, categories: inactiveCounts },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Risk Radar] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
