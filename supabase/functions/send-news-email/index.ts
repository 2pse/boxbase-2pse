import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  newsId: string
  title: string
  content: string
  statusFilter: 'all' | 'active' | 'inactive'
  membershipTypes: string[]
}

interface EmailRecipient {
  email: string
  first_name: string
  last_name: string
  membership_type: string
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

    // Admin check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { newsId, title, content, statusFilter, membershipTypes }: EmailRequest = await req.json()

    console.log('Processing news email:', { newsId, title, statusFilter, membershipTypes })

    // Check if email already sent (prevent duplicates)
    const { data: news } = await supabaseAdmin
      .from('news')
      .select('email_sent_at')
      .eq('id', newsId)
      .single()

    if (news?.email_sent_at) {
      console.log('Email already sent for this news')
      return new Response(
        JSON.stringify({ message: 'Email already sent', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Load webhook URL
    const { data: settings } = await supabaseAdmin
      .from('gym_settings')
      .select('webhook_news_url')
      .single()

    const webhookUrl = settings?.webhook_news_url

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: 'Webhook URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Load active memberships
    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from('user_memberships_v2')
      .select('user_id, membership_plans_v2(name)')
      .eq('status', 'active')

    if (membershipsError) {
      console.error('Error loading memberships:', membershipsError)
      return new Response(
        JSON.stringify({ error: 'Error loading memberships' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const membershipMap = new Map(
      memberships?.map(m => [
        m.user_id,
        (m.membership_plans_v2 as any)?.name
      ]) || []
    )

    const userIds = Array.from(membershipMap.keys())

    // Load profiles with status filter
    let profilesQuery = supabaseAdmin
      .from('profiles')
      .select('user_id, first_name, last_name, display_name, status')
      .in('user_id', userIds)

    if (statusFilter !== 'all') {
      profilesQuery = profilesQuery.eq('status', statusFilter)
    }

    const { data: profiles, error: profilesError } = await profilesQuery

    if (profilesError) {
      console.error('Error loading profiles:', profilesError)
      return new Response(
        JSON.stringify({ error: 'Error loading profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter by membership types
    const filteredProfiles = profiles?.filter(p => {
      const membershipType = membershipMap.get(p.user_id)
      return membershipType && membershipTypes.includes(membershipType)
    }) || []

    if (filteredProfiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, batches: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Load email addresses with pagination
    const selectedUserIds = filteredProfiles.map(p => p.user_id)
    const allAuthUsers: any[] = []
    let page = 1
    const perPage = 1000

    while (true) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage
      })

      if (!data || data.users.length === 0) break

      allAuthUsers.push(...data.users.filter(u => selectedUserIds.includes(u.id)))

      if (data.users.length < perPage) break
      page++
    }

    const emailMap = new Map(allAuthUsers.map(u => [u.id, u.email]))

    // Create recipients array
    const recipients: EmailRecipient[] = filteredProfiles
      .map(profile => {
        const email = emailMap.get(profile.user_id)
        if (!email) return null

        return {
          email,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          membership_type: membershipMap.get(profile.user_id) || 'Member',
          subject: title,
          body: content
        }
      })
      .filter((r): r is EmailRecipient => r !== null)

    console.log(`Created ${recipients.length} recipients`)

    // Batching (50 per batch)
    const batchSize = 50
    const batches: EmailRecipient[][] = []
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize))
    }

    // Sequential sending
    let successfulBatches = 0

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const payload = {
        event_type: 'news_email',
        batch_number: i + 1,
        total_batches: batches.length,
        total_recipients: recipients.length,
        timestamp: new Date().toISOString(),
        news: {
          id: newsId,
          title: title,
          content: content
        },
        emails: batch
      }

      console.log(`Sending batch ${i + 1}/${batches.length} with ${batch.length} emails`)

      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (webhookResponse.ok) {
        successfulBatches++
        console.log(`Batch ${i + 1} sent successfully`)
      } else {
        const errorText = await webhookResponse.text()
        console.error(`Batch ${i + 1} failed:`, errorText)
      }

      // 1 second delay between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Set email_sent_at timestamp (prevents duplicate sends)
    if (successfulBatches > 0) {
      await supabaseAdmin
        .from('news')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', newsId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: recipients.length,
        batches: successfulBatches
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in send-news-email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
