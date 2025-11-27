import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  subject: string
  body: string
  selectedUserIds: string[]
}

interface EmailRecipient {
  email: string
  first_name: string
  last_name: string
  membership_type: string
  email_and_code: string
  subject: string
  body: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Extract and validate JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError || !roleData) {
      console.error('Role check error:', roleError)
      return new Response(
        JSON.stringify({ error: 'No admin permission' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { subject, body, selectedUserIds }: EmailRequest = await req.json()

    if (!subject || !body || !selectedUserIds || !Array.isArray(selectedUserIds) || selectedUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing email request for ${selectedUserIds.length} users`)

    // Load active memberships for these users
    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from('user_memberships_v2')
      .select('user_id, membership_plans_v2(name)')
      .in('user_id', selectedUserIds)
      .eq('status', 'active')

    if (membershipsError) {
      console.error('Error loading memberships:', membershipsError)
    }
    
    const membershipMap = new Map(
      memberships?.map(m => [
        m.user_id,
        (m.membership_plans_v2 as any)?.name || 'No Membership'
      ]) || []
    )

    // Load profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, first_name, last_name, access_code')
      .in('user_id', selectedUserIds)
      .not('user_id', 'is', null)

    if (profilesError) {
      console.error('Error loading profiles:', profilesError)
      return new Response(
        JSON.stringify({ error: 'Error loading profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Loaded ${profiles?.length || 0} profiles`)

    // Load email addresses with pagination
    const userEmailMap = new Map<string, string>()
    let page = 1
    const perPage = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage
      })
      
      if (usersError) {
        console.error('Error loading users:', usersError)
        break
      }
      
      usersData.users?.forEach(u => {
        if (u.email) {
          userEmailMap.set(u.id, u.email)
        }
      })
      
      hasMore = (usersData.users?.length || 0) === perPage
      page++
    }

    console.log(`Loaded ${userEmailMap.size} email addresses`)

    // Personalization function
    const personalizeText = (text: string, profile: any, email: string, membershipName: string): string => {
      return text
        .replace(/\{\{first_name\}\}/g, profile.first_name || '')
        .replace(/\{\{last_name\}\}/g, profile.last_name || '')
        .replace(/\{\{membership_type\}\}/g, membershipName)
        .replace(/\{\{email_and_code\}\}/g, 
          `Email: ${email}\nAccess Code: ${profile.access_code || 'N/A'}`
        )
    }

    // Create recipients array with personalized content
    const recipients: EmailRecipient[] = (profiles || [])
      .map(profile => {
        const email = userEmailMap.get(profile.user_id)
        if (!email) return null
        
        const membershipName = membershipMap.get(profile.user_id) || 'No Membership'
        
        return {
          email,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          membership_type: membershipName,
          email_and_code: `Email: ${email}\nAccess Code: ${profile.access_code || 'N/A'}`,
          subject: personalizeText(subject, profile, email, membershipName),
          body: personalizeText(body, profile, email, membershipName)
        }
      })
      .filter((r): r is EmailRecipient => r !== null)

    console.log(`Created ${recipients.length} recipients with personalized content`)

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid recipients found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Load webhook URL from gym_settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('gym_settings')
      .select('webhook_email_url')
      .single()

    if (settingsError || !settings?.webhook_email_url) {
      console.error('Webhook URL not configured:', settingsError)
      return new Response(
        JSON.stringify({ error: 'Webhook URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const webhookUrl = settings.webhook_email_url

    // Create batches (50 recipients per batch)
    const BATCH_SIZE = 50
    const batches: EmailRecipient[][] = []
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      batches.push(recipients.slice(i, i + BATCH_SIZE))
    }

    console.log(`Created ${batches.length} batches`)

    // Send batches sequentially with delay
    for (let i = 0; i < batches.length; i++) {
      const payload = {
        event_type: 'bulk_email',
        batch_number: i + 1,
        total_batches: batches.length,
        total_recipients: recipients.length,
        timestamp: new Date().toISOString(),
        emails: batches[i]
      }
      
      console.log(`Sending batch ${i + 1}/${batches.length} with ${batches[i].length} emails`)
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Batch ${i + 1} failed:`, errorText)
      } else {
        console.log(`Batch ${i + 1} sent successfully`)
      }
      
      // 1 second pause between batches (except last batch)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: recipients.length,
        batches: batches.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in send-bulk-emails:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
