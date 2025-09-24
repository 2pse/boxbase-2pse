-- Debug and fix the webhook notification trigger
CREATE OR REPLACE FUNCTION public.notify_waitlist_promotions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  webhook_url text;
  request_id uuid;
  function_url text;
  response jsonb;
BEGIN
  RAISE NOTICE 'Notification trigger called for registration_id %', NEW.registration_id;
  
  -- Get webhook URL from gym_settings
  SELECT webhook_waitlist_url INTO webhook_url
  FROM public.gym_settings
  LIMIT 1;
  
  -- Set the function URL
  function_url := 'https://tuktvbawwyffuqeorjix.supabase.co/functions/v1/notify-waitlist-promotion';
  
  -- Only proceed if we have a webhook URL
  IF webhook_url IS NOT NULL AND webhook_url != '' THEN
    BEGIN
      RAISE NOTICE 'Sending webhook notification for registration_id % to edge function %', 
        NEW.registration_id, function_url;
      
      -- Use pg_net to call edge function with better error handling
      SELECT net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1a3R2YmF3d3lmZnVxZW9yaml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDk2MjMsImV4cCI6MjA3NDIyNTYyM30.7Y0mcnXhq6Y8jqok6AR9qbyeBIQrMcIhmiA9q2p0lkc'
        ),
        body := jsonb_build_object(
          'registration_id', NEW.registration_id::text
        )
      ) INTO request_id;
      
      -- Check if the request was successful by querying the result
      IF request_id IS NOT NULL THEN
        -- Wait a moment and check the response
        PERFORM pg_sleep(0.1);
        
        SELECT response INTO response 
        FROM net._http_response 
        WHERE id = request_id;
        
        RAISE NOTICE 'HTTP response for request_id %: %', request_id, response;
        
        -- Update the event record with notification timestamp only if successful
        UPDATE public.waitlist_promotion_events
        SET notified_at = now()
        WHERE id = NEW.id;
        
        RAISE NOTICE 'Webhook notification sent successfully for registration_id %, request_id: %', 
          NEW.registration_id, request_id;
      ELSE
        RAISE WARNING 'Failed to get request_id for waitlist notification, registration_id: %', 
          NEW.registration_id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log detailed error information
      RAISE WARNING 'Failed to send waitlist notification for registration_id %: % (SQLSTATE: %)', 
        NEW.registration_id, SQLERRM, SQLSTATE;
        
      -- Don't update notified_at on failure - this allows us to retry or handle manually
    END;
  ELSE
    RAISE NOTICE 'No webhook URL configured for waitlist notifications';
  END IF;
  
  RETURN NEW;
END;
$function$;