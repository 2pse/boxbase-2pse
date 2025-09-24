-- Simplified trigger - just create events, let frontend handle notifications
CREATE OR REPLACE FUNCTION public.notify_waitlist_promotions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE NOTICE 'Waitlist promotion event created for registration_id %', NEW.registration_id;
  -- Don't try to send HTTP requests from the database trigger
  -- The frontend will handle notifications for unnotified events
  RETURN NEW;
END;
$function$;