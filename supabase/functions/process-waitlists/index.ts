import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Course {
  id: string;
  title: string;
  max_participants: number;
  registered_count: number;
  waitlisted_count: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Starting waitlist processing...');

    // Get all courses with waitlisted participants
    const { data: coursesWithWaitlists, error: coursesError } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        max_participants,
        course_date,
        start_time,
        end_time,
        course_registrations!inner(status)
      `)
      .gte('course_date', new Date().toISOString().split('T')[0])
      .eq('course_registrations.status', 'waitlist');

    if (coursesError) {
      console.error('❌ Error fetching courses:', coursesError);
      throw coursesError;
    }

    if (!coursesWithWaitlists || coursesWithWaitlists.length === 0) {
      console.log('✅ No courses with waitlists found');
      return new Response(
        JSON.stringify({ message: 'No courses with waitlists found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${coursesWithWaitlists.length} courses with waitlists`);

    let totalProcessed = 0;
    let totalPromoted = 0;

    // Process each course
    for (const course of coursesWithWaitlists) {
      try {
        console.log(`🏃‍♂️ Processing course: ${course.title} (${course.id})`);

        // Get current registration counts
        const { data: registrations, error: regError } = await supabase
          .from('course_registrations')
          .select('status')
          .eq('course_id', course.id);

        if (regError) {
          console.error(`❌ Error fetching registrations for course ${course.id}:`, regError);
          continue;
        }

        const registeredCount = registrations?.filter(r => r.status === 'registered').length || 0;
        const waitlistedCount = registrations?.filter(r => r.status === 'waitlist').length || 0;
        const availableSpots = course.max_participants - registeredCount;

        console.log(`📊 Course ${course.title}: ${registeredCount}/${course.max_participants} registered, ${waitlistedCount} waitlisted, ${availableSpots} spots available`);

        if (availableSpots <= 0 || waitlistedCount === 0) {
          console.log(`⏭️ Skipping course ${course.title}: no spots or no waitlist`);
          continue;
        }

        // Get waitlisted users ordered by registration time
        const { data: waitlistedUsers, error: waitlistError } = await supabase
          .from('course_registrations')
          .select('id, user_id, registered_at')
          .eq('course_id', course.id)
          .eq('status', 'waitlist')
          .order('registered_at', { ascending: true })
          .limit(availableSpots);

        if (waitlistError) {
          console.error(`❌ Error fetching waitlisted users for course ${course.id}:`, waitlistError);
          continue;
        }

        if (!waitlistedUsers || waitlistedUsers.length === 0) {
          console.log(`⏭️ No waitlisted users found for course ${course.title}`);
          continue;
        }

        const usersToPromote = Math.min(waitlistedUsers.length, availableSpots);
        console.log(`🎯 Promoting ${usersToPromote} users from waitlist for course ${course.title}`);

        // Promote users from waitlist to registered
        for (let i = 0; i < usersToPromote; i++) {
          const user = waitlistedUsers[i];
          
          const { error: updateError } = await supabase
            .from('course_registrations')
            .update({ 
              status: 'registered',
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (updateError) {
            console.error(`❌ Error promoting user ${user.user_id} for course ${course.id}:`, updateError);
            continue;
          }

          console.log(`✅ Promoted user ${user.user_id} from waitlist to registered for course ${course.title}`);
          
          // Send webhook notification for automatic promotion
          try {
            const webhookUrl = Deno.env.get('MAKE_WAITLIST_WEBHOOK_URL');
            if (webhookUrl) {
              // Get user profile and email for webhook (fixed columns and filter)
              const { data: profile } = await supabase
                .from('profiles')
                .select('display_name, membership_type')
                .eq('user_id', user.user_id)
                .maybeSingle();

              const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user.user_id);

              const webhookData = {
                event_type: 'waitlist_promoted',
                promotion_type: 'automatic',
                promoted_at: new Date().toISOString(),

                course_id: course.id,
                course_title: course.title,
                course_date: (course as any).course_date ?? null,
                start_time: (course as any).start_time ?? null,
                end_time: (course as any).end_time ?? null,

                user_id: user.user_id,
                user_email: authUser?.email || 'unknown',
                user_name: profile?.display_name || 'Unbekannt',
                membership: profile?.membership_type || 'Member'
              };

              const webhookResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookData),
              });

              if (webhookResponse.ok) {
                console.log(`📧 Webhook notification sent for user ${user.user_id} promotion`);
              } else {
                console.error(`❌ Failed to send webhook for user ${user.user_id}:`, webhookResponse.status);
              }
            }
          } catch (webhookError) {
            console.error(`❌ Error sending webhook for user ${user.user_id}:`, webhookError);
          }
          
          totalPromoted++;
        }

        totalProcessed++;

      } catch (courseError) {
        console.error(`❌ Error processing course ${course.id}:`, courseError);
        continue;
      }
    }

    const result = {
      message: 'Waitlist processing completed',
      coursesProcessed: totalProcessed,
      usersPromoted: totalPromoted,
      timestamp: new Date().toISOString()
    };

    console.log(`🎉 Waitlist processing completed: ${totalProcessed} courses processed, ${totalPromoted} users promoted`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fatal error in waitlist processing:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process waitlists', 
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
