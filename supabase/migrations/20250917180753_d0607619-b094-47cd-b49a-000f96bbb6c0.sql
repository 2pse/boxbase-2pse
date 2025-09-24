-- Improve the process_course_waitlist function to log promotions and trigger notifications
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
  -- Get available spots
  SELECT 
    (c.max_participants - COALESCE(COUNT(cr.id), 0)) as spots
  INTO available_spots
  FROM public.courses c
  LEFT JOIN public.course_registrations cr ON c.id = cr.course_id 
    AND cr.status = 'registered'
  WHERE c.id = course_id_param
  GROUP BY c.max_participants;

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
      
      -- Log the promotion event
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
      
      -- Log for debugging
      RAISE NOTICE 'User % promoted from waitlist for course %', waitlist_user.user_id, course_id_param;
    END LOOP;
  END IF;
END;
$function$;

-- Create function to handle course cancellation and trigger waitlist processing
CREATE OR REPLACE FUNCTION public.handle_course_cancellation_waitlist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process if status changed from 'registered' to 'cancelled'
  IF OLD.status = 'registered' AND NEW.status = 'cancelled' THEN
    -- Process waitlist for this course
    PERFORM public.process_course_waitlist(NEW.course_id);
    
    -- Log the cancellation that triggered waitlist processing
    RAISE NOTICE 'Course cancellation triggered waitlist processing for course %', NEW.course_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for automatic waitlist processing on cancellations
DROP TRIGGER IF EXISTS trigger_course_cancellation_waitlist ON public.course_registrations;
CREATE TRIGGER trigger_course_cancellation_waitlist
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_course_cancellation_waitlist();

-- Create function to notify about waitlist promotions
CREATE OR REPLACE FUNCTION public.notify_waitlist_promotions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  webhook_url text;
  request_id uuid;
BEGIN
  -- Get webhook URL from gym_settings
  SELECT webhook_waitlist_url INTO webhook_url
  FROM public.gym_settings
  LIMIT 1;
  
  -- Only proceed if we have a webhook URL and pg_net extension is available
  IF webhook_url IS NOT NULL AND webhook_url != '' THEN
    BEGIN
      -- Use pg_net to make HTTP request to edge function
      SELECT net.http_post(
        url := 'https://tuktvbawwyffuqeorjix.supabase.co/functions/v1/notify-waitlist-promotion',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1a3R2YmF3d3lmZnVxZW9yaml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDk2MjMsImV4cCI6MjA3NDIyNTYyM30.7Y0mcnXhq6Y8jqok6AR9qbyeBIQrMcIhmiA9q2p0lkc'
        ),
        body := jsonb_build_object(
          'registration_id', NEW.registration_id
        )
      ) INTO request_id;
      
      -- Update the event record with notification timestamp
      UPDATE public.waitlist_promotion_events
      SET notified_at = now()
      WHERE id = NEW.id;
      
      RAISE NOTICE 'Waitlist promotion notification sent for registration %, request_id: %', NEW.registration_id, request_id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Failed to send waitlist notification: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'No webhook URL configured for waitlist notifications';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for notifying about waitlist promotions
DROP TRIGGER IF EXISTS trigger_notify_waitlist_promotions ON public.waitlist_promotion_events;
CREATE TRIGGER trigger_notify_waitlist_promotions
  AFTER INSERT ON public.waitlist_promotion_events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_waitlist_promotions();