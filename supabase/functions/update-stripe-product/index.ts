import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Update Stripe product function started")

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

    const { plan_id, old_price } = await req.json()

    if (!plan_id) {
      throw new Error('Plan ID is required')
    }

    // Get current plan data
    const { data: plan, error: planError } = await supabaseClient
      .from('membership_plans_v2')
      .select('*')
      .eq('id', plan_id)
      .single()

    if (planError || !plan) {
      throw new Error('Plan not found')
    }

    // If no Stripe product linked, nothing to update
    if (!plan.stripe_product_id) {
      return new Response(
        JSON.stringify({ success: true, message: 'No Stripe product linked, skipping update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    })

    console.log(`Updating Stripe product for plan: ${plan.name}`)

    // Update product name and description
    await stripe.products.update(plan.stripe_product_id, {
      name: plan.name,
      description: plan.description || undefined,
    })
    console.log('Updated Stripe product name/description')

    // Check if price changed
    const currentPrice = plan.price_monthly || 0
    const previousPrice = old_price || 0
    const priceChanged = Math.abs(currentPrice - previousPrice) > 0.01

    if (priceChanged && plan.stripe_price_id) {
      console.log(`Price changed from ${previousPrice} to ${currentPrice}, creating new Stripe price`)

      // Create new price
      const priceConfig: any = {
        product: plan.stripe_product_id,
        unit_amount: Math.round(currentPrice * 100),
        currency: 'eur',
      }

      // Add recurring configuration for monthly payments
      if (plan.payment_frequency === 'monthly') {
        priceConfig.recurring = { interval: 'month' }
      }

      const newPrice = await stripe.prices.create(priceConfig)
      console.log(`Created new Stripe price: ${newPrice.id}`)

      // Deactivate old price
      try {
        await stripe.prices.update(plan.stripe_price_id, { active: false })
        console.log(`Deactivated old Stripe price: ${plan.stripe_price_id}`)
      } catch (e: any) {
        console.warn(`Could not deactivate old price: ${e.message}`)
      }

      // Update plan with new price ID
      const { error: updateError } = await supabaseClient
        .from('membership_plans_v2')
        .update({ stripe_price_id: newPrice.id })
        .eq('id', plan_id)

      if (updateError) {
        throw new Error(`Failed to update plan with new price ID: ${updateError.message}`)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Stripe product and price updated',
          new_price_id: newPrice.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Stripe product updated (price unchanged)' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in update-stripe-product function:', error)
    
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
