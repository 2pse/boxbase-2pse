import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

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

    // ========== NEW: Cancel all Stripe subscriptions before deleting ==========
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, {
        apiVersion: '2023-10-16',
      })

      // Get all memberships with Stripe subscriptions
      const { data: memberships } = await supabaseClient
        .from('user_memberships_v2')
        .select('stripe_subscription_id, stripe_customer_id')
        .eq('user_id', userId)
        .not('stripe_subscription_id', 'is', null)

      console.log(`Found ${memberships?.length || 0} memberships with Stripe subscriptions`)

      // Cancel all active Stripe subscriptions
      for (const membership of memberships || []) {
        if (membership.stripe_subscription_id) {
          try {
            await stripe.subscriptions.cancel(membership.stripe_subscription_id)
            console.log(`Cancelled Stripe subscription: ${membership.stripe_subscription_id}`)
          } catch (stripeError: any) {
            // Subscription might already be cancelled or not exist
            console.warn(`Could not cancel subscription ${membership.stripe_subscription_id}: ${stripeError.message}`)
          }
        }
      }
    } else {
      console.log('No STRIPE_SECRET_KEY configured, skipping subscription cancellation')
    }

    // Delete user_memberships_v2
    const { error: membershipsError } = await supabaseClient
      .from('user_memberships_v2')
      .delete()
      .eq('user_id', userId)

    if (membershipsError) {
      console.error('Error deleting user memberships:', membershipsError)
    }

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
        message: 'User deleted successfully from both profiles and auth, Stripe subscriptions cancelled' 
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
