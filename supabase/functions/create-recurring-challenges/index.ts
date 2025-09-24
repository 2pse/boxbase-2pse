import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the current year and next year
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    // Find all recurring challenges from the current year
    const { data: recurringChallenges, error: fetchError } = await supabaseClient
      .from('monthly_challenges')
      .select('*')
      .eq('is_recurring', true)
      .eq('year', currentYear);

    if (fetchError) {
      console.error('Error fetching recurring challenges:', fetchError);
      throw fetchError;
    }

    if (!recurringChallenges || recurringChallenges.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recurring challenges found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const createdChallenges = [];

    // Create challenges for next year
    for (const challenge of recurringChallenges) {
      // Check if challenge already exists for next year
      const { data: existingChallenge } = await supabaseClient
        .from('monthly_challenges')
        .select('id')
        .eq('title', challenge.title)
        .eq('month', challenge.month)
        .eq('year', nextYear)
        .single();

      if (existingChallenge) {
        console.log(`Challenge ${challenge.title} for ${challenge.month}/${nextYear} already exists`);
        continue;
      }

      // Create new challenge for next year
      const { data: newChallenge, error: insertError } = await supabaseClient
        .from('monthly_challenges')
        .insert({
          title: challenge.title,
          description: challenge.description,
          checkpoint_count: challenge.checkpoint_count,
          month: challenge.month,
          year: nextYear,
          icon: challenge.icon,
          bonus_points: challenge.bonus_points,
          is_recurring: true,
          is_primary: challenge.is_primary,
          is_archived: false,
          created_by: challenge.created_by
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Error creating challenge ${challenge.title}:`, insertError);
        continue;
      }

      createdChallenges.push(newChallenge);
      console.log(`Created recurring challenge: ${challenge.title} for ${challenge.month}/${nextYear}`);
    }

    return new Response(
      JSON.stringify({
        message: `Successfully created ${createdChallenges.length} recurring challenges for ${nextYear}`,
        createdChallenges
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-recurring-challenges:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});