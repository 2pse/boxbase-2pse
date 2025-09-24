-- Enable pg_net extension for HTTP calls from the database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS trigger_process_waitlists_on_cancellation ON public.course_registrations;
DROP FUNCTION IF EXISTS process_waitlists_on_cancellation();

-- Recreate the function using net.http_post and safe error handling
CREATE OR REPLACE FUNCTION process_waitlists_on_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  course_rec RECORD;
  waitlist_rec RECORD;
  current_registered_count INTEGER;
  resp JSONB;
BEGIN
  -- Only handle when status changes from registered/waitlist to cancelled
  IF OLD.status IN ('registered', 'waitlist') AND NEW.status = 'cancelled' THEN
    BEGIN
      -- Fetch course
      SELECT * INTO course_rec FROM public.courses WHERE id = NEW.course_id;

      IF FOUND THEN
        -- Count current registered
        SELECT COUNT(*) INTO current_registered_count
        FROM public.course_registrations
        WHERE course_id = NEW.course_id AND status = 'registered';

        -- If spot available and waitlist exists, promote earliest
        IF current_registered_count < course_rec.max_participants THEN
          SELECT * INTO waitlist_rec
          FROM public.course_registrations
          WHERE course_id = NEW.course_id AND status = 'waitlist'
          ORDER BY registered_at ASC
          LIMIT 1;

          IF FOUND THEN
            -- Promote
            UPDATE public.course_registrations
            SET status = 'registered',
                updated_at = now()
            WHERE id = waitlist_rec.id;

            -- Log event
            INSERT INTO public.waitlist_promotion_events (registration_id, course_id, user_id, payload)
            VALUES (
              waitlist_rec.id,
              NEW.course_id,
              waitlist_rec.user_id,
              jsonb_build_object(
                'event_type','waitlist_promoted',
                'course_id', NEW.course_id,
                'registration_id', waitlist_rec.id,
                'user_id', waitlist_rec.user_id,
                'promotion_type','automatic',
                'promoted_at', now()
              )
            );

            -- Trigger the dispatcher edge function (public) and ignore failures
            BEGIN
              SELECT net.http_post(
                url := 'https://vdpeyaphtsbrhygupfbc.supabase.co/functions/v1/dispatch-waitlist-promotion-events',
                headers := '{"Content-Type":"application/json"}'::jsonb,
                body := '{}'
              )::jsonb INTO resp;
            EXCEPTION WHEN OTHERS THEN
              RAISE WARNING 'dispatch call failed: %', SQLERRM;
            END;
          END IF;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log but do not rollback promotion
      RAISE WARNING 'Error processing waitlist: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_process_waitlists_on_cancellation
    AFTER UPDATE ON public.course_registrations
    FOR EACH ROW
    EXECUTE FUNCTION process_waitlists_on_cancellation();