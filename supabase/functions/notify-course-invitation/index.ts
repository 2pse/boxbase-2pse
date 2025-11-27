import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { invitation_id } = await req.json()

    console.log('Processing invitation notification for:', invitation_id)

    // Load invitation with course details
    const { data: invitation, error: invError } = await supabase
      .from('course_invitations')
      .select(`
        *,
        courses (title, course_date, start_time, end_time, trainer)
      `)
      .eq('id', invitation_id)
      .single()

    if (invError) throw invError

    // Load sender profile
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('nickname, display_name, first_name, last_name')
      .eq('user_id', invitation.sender_id)
      .single()

    // Load recipient profile
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('nickname, display_name, first_name, last_name')
      .eq('user_id', invitation.recipient_id)
      .single()

    // Load recipient email from auth.users using admin API
    const { data: { user: recipientUser }, error: userError } = await supabase.auth.admin.getUserById(
      invitation.recipient_id
    )

    if (userError) {
      console.error('Error fetching recipient user:', userError)
    }

    // Load webhook URL from gym_settings
    const { data: settings } = await supabase
      .from('gym_settings')
      .select('webhook_invitation_url')
      .single()

    if (!settings?.webhook_invitation_url) {
      console.log('No invitation webhook URL configured')
      return new Response(
        JSON.stringify({ success: true, message: 'No webhook configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare webhook payload with separate name fields
    const webhookPayload = {
      invitation_id: invitation.id,
      course: {
        title: invitation.courses.title,
        date: invitation.courses.course_date,
        start_time: invitation.courses.start_time,
        end_time: invitation.courses.end_time,
        trainer: invitation.courses.trainer
      },
      sender: {
        id: invitation.sender_id,
        first_name: senderProfile?.first_name || null,
        last_name: senderProfile?.last_name || null,
        nickname: senderProfile?.nickname || null,
        display_name: senderProfile?.display_name || null
      },
      recipient: {
        id: invitation.recipient_id,
        first_name: recipientProfile?.first_name || null,
        last_name: recipientProfile?.last_name || null,
        nickname: recipientProfile?.nickname || null,
        display_name: recipientProfile?.display_name || null,
        email: recipientUser?.email || null
      },
      message: invitation.message,
      created_at: invitation.created_at
    }

    console.log('Sending webhook payload:', JSON.stringify(webhookPayload, null, 2))

    // Send to external webhook (e.g., Make.com)
    const webhookResponse = await fetch(settings.webhook_invitation_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    })

    console.log('Webhook response status:', webhookResponse.status)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in notify-course-invitation:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
