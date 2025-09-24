-- Drop all existing triggers that might be conflicting
DROP TRIGGER IF EXISTS handle_course_cancellation_trigger ON public.course_registrations;
DROP TRIGGER IF EXISTS handle_course_cancellation_waitlist_trigger ON public.course_registrations;
DROP TRIGGER IF EXISTS notify_waitlist_promotions_trigger ON public.waitlist_promotion_events;

-- Drop old functions that might be causing conflicts
DROP FUNCTION IF EXISTS public.handle_course_cancellation();

-- Recreate the process_course_waitlist function with better UUID handling and debugging
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
  -- Log the start of waitlist processing
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
      
      -- Create waitlist promotion event with correct UUID
      INSERT INTO public.waitlist_promotion_events (
        registration_id,
        course_id,
        user_id,
        payload,
        created_at
      ) VALUES (
        promoted_registration_id,  -- This is the UUID from course_registrations.id
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

-- Recreate the trigger function for course cancellations
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

-- Recreate the notification trigger function with better error handling
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
  RAISE NOTICE 'Notification trigger called for registration_id %', NEW.registration_id;
  
  -- Get webhook URL from gym_settings
  SELECT webhook_waitlist_url INTO webhook_url
  FROM public.gym_settings
  LIMIT 1;
  
  -- Only proceed if we have a webhook URL and pg_net extension is available
  IF webhook_url IS NOT NULL AND webhook_url != '' THEN
    BEGIN
      RAISE NOTICE 'Sending webhook notification for registration_id % to %', NEW.registration_id, webhook_url;
      
      -- Use pg_net to make HTTP request to edge function
      SELECT net.http_post(
        url := 'https://tuktvbawwyffuqeorjix.supabase.co/functions/v1/notify-waitlist-promotion',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlzb2djc3Rud3hreXd2Y3lmbHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTk4ODYsImV4cCI6MjA3MDU3NTg4Mn0.yzJh1JBKCQKbfR7TyNKY1S8PMNxVxHK1B7iUQlD6mD8'
        ),
        body := jsonb_build_object(
          'registration_id', NEW.registration_id::text  -- Ensure it's passed as text UUID
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

-- Create the single trigger for course cancellations
CREATE TRIGGER handle_course_cancellation_waitlist_trigger
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_course_cancellation_waitlist();

-- Create the trigger for waitlist promotion notifications  
CREATE TRIGGER notify_waitlist_promotions_trigger
  AFTER INSERT ON public.waitlist_promotion_events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_waitlist_promotions();