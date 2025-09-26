import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { email, password, user_metadata } = await req.json()
    
    console.log('Received request with:', { 
      email, 
      first_name: user_metadata?.first_name,
      last_name: user_metadata?.last_name,
      membership_type: user_metadata?.membership_type 
    })

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const userExists = existingUser.users?.find(user => user.email === email)
    
    if (userExists) {
      console.log('User already exists with email:', email)
      return new Response(
        JSON.stringify({ 
          error: `Ein Benutzer mit der E-Mail-Adresse "${email}" ist bereits registriert.`,
          code: 'USER_ALREADY_EXISTS'
        }),
        { 
          status: 409, // Conflict status code
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create user with admin privileges
    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata
    })

    if (createError) {
      console.error('Error creating user:', createError)
      
      // Handle specific error cases
      let errorMessage = createError.message
      if (createError.message.includes('email address has already been registered')) {
        errorMessage = `Ein Benutzer mit der E-Mail-Adresse "${email}" ist bereits registriert.`
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Add appropriate role based on membership type
    const membershipType = user_metadata?.membership_type
    console.log('Membership type received:', membershipType)
    
    // Assign role - only admin and trainer get special roles, everyone else gets member
    let role = 'member' // default role
    
    if (membershipType === 'Trainer') {
      role = 'trainer'
    } else if (membershipType === 'Administrator') {
      role = 'admin'
    }
    
    console.log('Role assigned:', role)
    
    if (data?.user) {
      console.log('Attempting to add role:', role, 'for user:', data.user.id)
      
      // Check if role already exists (might be added by trigger)
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', data.user.id)
        .eq('role', role)
        .single()

      if (!existingRole) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: data.user.id,
            role: role
          })

        if (roleError) {
          console.error('Error adding role:', roleError)
          return new Response(
            JSON.stringify({ error: `Failed to assign role: ${roleError.message}` }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        } else {
          console.log('Successfully added role:', role)
        }
      } else {
        console.log('Role already exists for user')
      }
      
      // Note: Credits and membership plans are now handled through the membership_plans system
      // The trigger handle_new_user() already creates initial membership_credits entry
      console.log('User created successfully, membership will be assigned via Admin interface')
      
      // Send webhook to Make.com after successful member creation
      try {
        // Get webhook URL from database first, then fallback to environment variable
        let mainWebhookUrl = null;
        
        try {
          const { data: gymSettings } = await supabase
            .from('gym_settings')
            .select('webhook_member_url')
            .single();
          
          mainWebhookUrl = gymSettings?.webhook_member_url;
        } catch (error) {
          console.log('Could not load webhook URL from gym_settings:', error);
        }
        
        // Fallback to environment variable if not set in database
        if (!mainWebhookUrl) {
          mainWebhookUrl = Deno.env.get('MAKE_MAIN_WEBHOOK_URL');
        }
        
        const webhookData = {
          event_type: 'registration',
          name: user_metadata?.display_name || `${user_metadata?.first_name || ''} ${user_metadata?.last_name || ''}`.trim() || 'Unbekannt',
          first_name: user_metadata?.first_name || '',
          last_name: user_metadata?.last_name || '',
          email: email,
          access_code: user_metadata?.access_code || '',
          membership_type: membershipType || 'Member',
          created_at: new Date().toISOString(),
          user_id: data.user.id
        }
        
        console.log('Sending webhook to Make.com:', webhookData, '->', mainWebhookUrl)
        
        if (!mainWebhookUrl) {
          console.warn('No webhook URL configured - neither in database nor environment variable')
        } else {
          const webhookResponse = await fetch(mainWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookData)
          })
          
          if (webhookResponse.ok) {
            console.log('Webhook sent successfully to Make.com')
          } else {
            console.error('Webhook failed:', await webhookResponse.text())
          }
        }
      } catch (webhookError) {
        console.error('Error sending webhook to Make.com:', webhookError)
        // Don't fail the main operation if webhook fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, user: data?.user }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})