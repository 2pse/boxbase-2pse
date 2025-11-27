import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Delete membership plan function started")

serve(async (req) => {
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

    // Verify admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Authentication failed')
    }

    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')

    if (!userRoles || userRoles.length === 0) {
      throw new Error('Insufficient permissions')
    }

    const { plan_id } = await req.json()

    if (!plan_id) {
      throw new Error('Plan ID is required')
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('membership_plans_v2')
      .select('*')
      .eq('id', plan_id)
      .single()

    if (planError || !plan) {
      throw new Error('Plan not found')
    }

    console.log(`Deleting plan: ${plan.name} (${plan_id})`)

    // Get ALL memberships for this plan (active and pending)
    const { data: memberships, error: membershipsError } = await supabaseClient
      .from('user_memberships_v2')
      .select('id, stripe_subscription_id, user_id')
      .eq('membership_plan_id', plan_id)
      .in('status', ['active', 'pending_activation'])

    if (membershipsError) {
      console.error('Error fetching memberships:', membershipsError)
    }

    const memberCount = memberships?.length || 0
    console.log(`Found ${memberCount} active memberships to cancel`)

    // Cancel all Stripe subscriptions
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    let cancelledCount = 0

    if (stripeKey && memberships && memberships.length > 0) {
      const stripe = new Stripe(stripeKey, {
        apiVersion: '2023-10-16',
      })

      for (const membership of memberships) {
        if (membership.stripe_subscription_id) {
          try {
            await stripe.subscriptions.cancel(membership.stripe_subscription_id)
            cancelledCount++
            console.log(`Cancelled subscription: ${membership.stripe_subscription_id}`)
          } catch (stripeError: any) {
            console.warn(`Could not cancel subscription ${membership.stripe_subscription_id}: ${stripeError.message}`)
          }
        }
      }

      // Archive Stripe product (don't delete, keep for history)
      if (plan.stripe_product_id) {
        try {
          await stripe.products.update(plan.stripe_product_id, { active: false })
          console.log(`Archived Stripe product: ${plan.stripe_product_id}`)
        } catch (e: any) {
          console.warn(`Could not archive Stripe product: ${e.message}`)
        }
      }
    }

    // Update all memberships to cancelled status
    if (memberships && memberships.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('user_memberships_v2')
        .update({ 
          status: 'cancelled',
          membership_data: {
            cancelled_reason: 'plan_deleted',
            cancelled_at: new Date().toISOString()
          }
        })
        .eq('membership_plan_id', plan_id)
        .in('status', ['active', 'pending_activation'])

      if (updateError) {
        console.error('Error updating memberships to cancelled:', updateError)
      }
    }

    // Delete the plan
    const { error: deleteError } = await supabaseClient
      .from('membership_plans_v2')
      .delete()
      .eq('id', plan_id)

    if (deleteError) {
      throw new Error(`Failed to delete plan: ${deleteError.message}`)
    }

    console.log(`Plan deleted successfully. Cancelled ${cancelledCount} Stripe subscriptions, updated ${memberCount} memberships.`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Plan "${plan.name}" deleted successfully`,
        cancelled_subscriptions: cancelledCount,
        affected_members: memberCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in delete-membership-plan function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
