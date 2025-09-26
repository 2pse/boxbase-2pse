import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Delete member function started")

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated and is an admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Authentication failed')
    }

    // Check if user is admin
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')

    if (!userRoles || userRoles.length === 0) {
      throw new Error('Insufficient permissions')
    }

    const { userId } = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    console.log(`Attempting to delete user: ${userId}`)

    // First, delete related data (user_roles, leaderboard_entries, training_sessions, etc.)
    const { error: userRolesError } = await supabaseClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (userRolesError) {
      console.error('Error deleting user roles:', userRolesError)
    }

    const { error: leaderboardError } = await supabaseClient
      .from('leaderboard_entries')
      .delete()
      .eq('user_id', userId)

    if (leaderboardError) {
      console.error('Error deleting leaderboard entries:', leaderboardError)
    }

    const { error: sessionsError } = await supabaseClient
      .from('training_sessions')
      .delete()
      .eq('user_id', userId)

    if (sessionsError) {
      console.error('Error deleting training sessions:', sessionsError)
    }

    const { error: plansError } = await supabaseClient
      .from('training_plans')
      .delete()
      .eq('user_id', userId)

    if (plansError) {
      console.error('Error deleting training plans:', plansError)
    }

    const { error: readNewsError } = await supabaseClient
      .from('user_read_news')
      .delete()
      .eq('user_id', userId)

    if (readNewsError) {
      console.error('Error deleting read news:', readNewsError)
    }

    const { error: registrationsError } = await supabaseClient
      .from('course_registrations')
      .delete()
      .eq('user_id', userId)

    if (registrationsError) {
      console.error('Error deleting course registrations:', registrationsError)
    }

    // Then delete from profiles table
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('user_id', userId)

    if (profileError) {
      console.error('Error deleting from profiles:', profileError)
      throw new Error(`Failed to delete profile: ${profileError.message}`)
    }

    console.log('Profile and related data deleted successfully')

    // Finally delete from auth.users using admin API
    const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(
      userId
    )

    if (authDeleteError) {
      console.error('Error deleting from auth.users:', authDeleteError)
      throw new Error(`Failed to delete user from auth: ${authDeleteError.message}`)
    }

    console.log('User deleted from auth successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted successfully from both profiles and auth' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in delete-member function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})