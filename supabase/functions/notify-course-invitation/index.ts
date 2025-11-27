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

    // Helper function for name resolution
    const getName = (profile: any) => 
      profile?.display_name || profile?.nickname || 
      `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown'

    // Prepare webhook payload
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
        name: getName(senderProfile)
      },
      recipient: {
        id: invitation.recipient_id,
        name: getName(recipientProfile)
      },
      message: invitation.message,
      created_at: invitation.created_at
    }

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
