import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface ReactivationWebhookEvent {
  id: string;
  user_id: string;
  profile_data: any;
  webhook_url: string | null;
  processed_at: string | null;
  success: boolean | null;
  error_message: string | null;
  created_at: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing reactivation webhooks...');

    // Get unprocessed webhook events
    const { data: events, error: fetchError } = await supabase
      .from('reactivation_webhook_events')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(50); // Process max 50 events per run

    if (fetchError) {
      console.error('Error fetching webhook events:', fetchError);
      throw fetchError;
    }

    if (!events || events.length === 0) {
      console.log('No unprocessed webhook events found');
      return new Response(
        JSON.stringify({ message: 'No events to process', processed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${events.length} unprocessed webhook events`);

    let processedCount = 0;
    let successCount = 0;

    for (const event of events as ReactivationWebhookEvent[]) {
      console.log(`Processing event ${event.id} for user ${event.user_id}`);

      let success = false;
      let errorMessage = null;

      try {
        if (event.webhook_url) {
          // Send webhook with payload structure matching member creation webhook
          const webhookPayload = {
            type: 'member_reactivation_needed',
            user_id: event.user_id,
            profile_data: event.profile_data,
            created_at: event.created_at,
            inactivity_duration_days: 21,
            // Mirror structure from member creation for Make.com compatibility
            data: event.profile_data
          };

          console.log(`Sending webhook to: ${event.webhook_url}`);
          
          const webhookResponse = await fetch(event.webhook_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'BoxBase-Reactivation-Webhook/1.0'
            },
            body: JSON.stringify(webhookPayload),
          });

          if (webhookResponse.ok) {
            success = true;
            successCount++;
            console.log(`Webhook sent successfully for user ${event.user_id}`);
          } else {
            const responseText = await webhookResponse.text();
            errorMessage = `HTTP ${webhookResponse.status}: ${responseText}`;
            console.error(`Webhook failed for user ${event.user_id}:`, errorMessage);
          }
        } else {
          success = true; // No webhook URL configured, mark as successful
          console.log(`No webhook URL configured, marking event ${event.id} as processed`);
        }
      } catch (error: any) {
        errorMessage = error.message || 'Unknown error occurred';
        console.error(`Error processing webhook for user ${event.user_id}:`, error);
      }

      // Update event status
      const { error: updateError } = await supabase
        .from('reactivation_webhook_events')
        .update({
          processed_at: new Date().toISOString(),
          success: success,
          error_message: errorMessage
        })
        .eq('id', event.id);

      if (updateError) {
        console.error(`Error updating event ${event.id}:`, updateError);
      } else {
        processedCount++;
      }
    }

    console.log(`Processed ${processedCount} events, ${successCount} successful webhooks`);

    return new Response(
      JSON.stringify({ 
        message: 'Webhook processing completed',
        processed: processedCount,
        successful: successCount,
        failed: processedCount - successCount
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in process-reactivation-webhooks function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        processed: 0 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);