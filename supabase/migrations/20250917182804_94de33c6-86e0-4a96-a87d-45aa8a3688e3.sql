-- Clean up ALL existing triggers and functions to prevent conflicts
DROP TRIGGER IF EXISTS handle_course_cancellation_waitlist_trigger ON public.course_registrations;
DROP TRIGGER IF EXISTS trigger_course_cancellation_waitlist ON public.course_registrations;
DROP TRIGGER IF EXISTS course_cancellation_promotion_trigger ON public.course_registrations;
DROP TRIGGER IF EXISTS handle_course_cancellation_trigger ON public.course_registrations;

DROP TRIGGER IF EXISTS notify_waitlist_promotions_trigger ON public.waitlist_promotion_events;
DROP TRIGGER IF EXISTS trigger_notify_waitlist_promotions ON public.waitlist_promotion_events;

-- Drop all old function versions
DROP FUNCTION IF EXISTS public.handle_course_cancellation();
DROP FUNCTION IF EXISTS public.handle_course_cancellation_waitlist();
DROP FUNCTION IF EXISTS public.process_course_waitlist(uuid);
DROP FUNCTION IF EXISTS public.notify_waitlist_promotions();

-- Create the main waitlist processing function with better logging
CREATE OR REPLACE FUNCTION public.process_course_waitlist(course_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  available_spots integer;
  waitlist_user record;
  promoted_registration_id uuid;
BEGIN
  RAISE NOTICE 'Starting waitlist processing for course %', course_id_param;

  -- Get available spots
  SELECT 
    (c.max_participants - COALESCE(COUNT(cr.id), 0)) as spots
  INTO available_spots
  FROM public.courses c
  LEFT JOIN public.course_registrations cr ON c.id = cr.course_id 
    AND cr.status = 'registered'
  WHERE c.id = course_id_param
  GROUP BY c.max_participants;

  RAISE NOTICE 'Available spots for course %: %', course_id_param, available_spots;

  -- Promote users from waitlist if spots available
  IF available_spots > 0 THEN
    FOR waitlist_user IN
      SELECT cr.id, cr.user_id
      FROM public.course_registrations cr
      WHERE cr.course_id = course_id_param 
        AND cr.status = 'waitlist'
      ORDER BY cr.registered_at
      LIMIT available_spots
    LOOP
      -- Update registration status
      UPDATE public.course_registrations
      SET status = 'registered', updated_at = now()
      WHERE id = waitlist_user.id;
      
      promoted_registration_id := waitlist_user.id;
      
      RAISE NOTICE 'Promoting user % with registration_id % for course %', 
        waitlist_user.user_id, promoted_registration_id, course_id_param;
      
      -- Create waitlist promotion event
      INSERT INTO public.waitlist_promotion_events (
        registration_id,
        course_id,
        user_id,
        payload,
        created_at
      ) VALUES (
        promoted_registration_id,
        course_id_param,
        waitlist_user.user_id,
        jsonb_build_object(
          'promoted_at', now(),
          'promotion_type', 'automatic',
          'available_spots', available_spots
        ),
        now()
      );
      
      RAISE NOTICE 'Created waitlist promotion event for registration_id %', promoted_registration_id;
    END LOOP;
  ELSE
    RAISE NOTICE 'No available spots for course %, skipping waitlist processing', course_id_param;
  END IF;
END;
$function$;

-- Create the trigger function for course cancellations
CREATE OR REPLACE FUNCTION public.handle_course_cancellation_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process if status changed from 'registered' to 'cancelled'
  IF OLD.status = 'registered' AND NEW.status = 'cancelled' THEN
    RAISE NOTICE 'Course cancellation detected: user % cancelled registration % for course %', 
      NEW.user_id, NEW.id, NEW.course_id;
    
    -- Process waitlist for this course
    PERFORM public.process_course_waitlist(NEW.course_id);
    
    RAISE NOTICE 'Waitlist processing completed for course %', NEW.course_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the notification trigger function with improved webhook handling
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
      
      -- Use pg_net to call edge function
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
      
      -- Update the event record with notification timestamp
      UPDATE public.waitlist_promotion_events
      SET notified_at = now()
      WHERE id = NEW.id;
      
      RAISE NOTICE 'Webhook notification sent successfully for registration_id %, request_id: %', 
        NEW.registration_id, request_id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Failed to send waitlist notification for registration_id %: %', 
        NEW.registration_id, SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'No webhook URL configured for waitlist notifications';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create ONLY the triggers we need (no duplicates)
CREATE TRIGGER handle_course_cancellation_waitlist_trigger
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_course_cancellation_waitlist();

CREATE TRIGGER notify_waitlist_promotions_trigger
  AFTER INSERT ON public.waitlist_promotion_events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_waitlist_promotions();