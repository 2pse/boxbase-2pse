-- Update the database trigger to use the dispatch edge function as fallback
CREATE OR REPLACE FUNCTION public.process_waitlists_on_cancellation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  course_rec RECORD;
  waitlist_rec RECORD;
  current_registered_count INTEGER;
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

            -- Log event for webhook processing
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

            -- Try to dispatch immediately via edge function (ignore failures)
            BEGIN
              PERFORM net.http_post(
                url := 'https://vdpeyaphtsbrhygupfbc.supabase.co/functions/v1/dispatch-waitlist-promotion-events',
                headers := '{"Content-Type":"application/json"}'::jsonb,
                body := '{"limit": 1}'
              );
            EXCEPTION WHEN OTHERS THEN
              -- Silently ignore webhook dispatch failures
              -- The event is logged and can be processed later
              NULL;
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
$function$;