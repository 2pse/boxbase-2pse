import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    console.log(`[sync-access-codes] Request started`);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[sync-access-codes] No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create regular client to check permissions
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[sync-access-codes] User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      console.error('[sync-access-codes] Access denied - not admin');
      return new Response(
        JSON.stringify({ error: 'Nur Admins können Zugangscodes synchronisieren' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { specificUserId, specificAccessCode } = await req.json();
    
    if (specificUserId && specificAccessCode) {
      // Sync specific user
      console.log(`[sync-access-codes] Syncing specific user: ${specificUserId}`);
      
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ access_code: specificAccessCode })
        .eq('user_id', specificUserId);

      if (profileError) {
        console.error('[sync-access-codes] Error updating specific user profile:', profileError);
        return new Response(
          JSON.stringify({ error: 'Fehler beim Aktualisieren des Profils', details: profileError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        specificUserId,
        { password: specificAccessCode }
      );

      if (authError) {
        console.error('[sync-access-codes] Error updating specific user auth:', authError);
        return new Response(
          JSON.stringify({ error: 'Fehler beim Aktualisieren des Auth-Passworts', details: authError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[sync-access-codes] Successfully synced user ${specificUserId}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Zugangscode für Benutzer erfolgreich synchronisiert`,
          syncedUsers: 1
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sync all users with access codes
    console.log(`[sync-access-codes] Starting bulk sync`);
    
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, access_code')
      .not('access_code', 'is', null);

    if (profilesError) {
      console.error('[sync-access-codes] Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Fehler beim Laden der Profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const profile of profiles) {
      if (!profile.access_code) continue;

      try {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          profile.user_id,
          { password: profile.access_code }
        );

        if (authError) {
          console.error(`[sync-access-codes] Error updating auth for user ${profile.user_id}:`, authError);
          results.push({ user_id: profile.user_id, success: false, error: authError.message });
          errorCount++;
        } else {
          console.log(`[sync-access-codes] Successfully synced user ${profile.user_id}`);
          results.push({ user_id: profile.user_id, success: true });
          successCount++;
        }
      } catch (error) {
        console.error(`[sync-access-codes] Exception for user ${profile.user_id}:`, error);
        results.push({ user_id: profile.user_id, success: false, error: error instanceof Error ? error.message : String(error) });
        errorCount++;
      }
    }

    console.log(`[sync-access-codes] Bulk sync completed. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synchronisation abgeschlossen: ${successCount} erfolgreich, ${errorCount} Fehler`,
        syncedUsers: successCount,
        errorCount,
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-access-codes] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Interner Serverfehler', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});