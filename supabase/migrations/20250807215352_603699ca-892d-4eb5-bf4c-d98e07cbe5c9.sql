-- Drop the trigger first, then the function, then recreate both
DROP TRIGGER IF EXISTS trigger_process_waitlists_on_cancellation ON public.course_registrations;
DROP FUNCTION IF EXISTS process_waitlists_on_cancellation();

-- Recreate the function to call both edge functions
CREATE OR REPLACE FUNCTION process_waitlists_on_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Nur verarbeiten, wenn Status von registered/waitlist auf cancelled geändert wurde
  IF OLD.status IN ('registered', 'waitlist') AND NEW.status = 'cancelled' THEN
    DECLARE
        course_rec RECORD;
        waitlist_rec RECORD;
        current_registered_count INTEGER;
    BEGIN
        -- Kursdetails
        SELECT * INTO course_rec FROM public.courses WHERE id = NEW.course_id;
        
        IF FOUND THEN
            -- Aktuell registrierte zählen
            SELECT COUNT(*) INTO current_registered_count
            FROM public.course_registrations
            WHERE course_id = NEW.course_id AND status = 'registered';
            
            -- Wenn Platz frei ist und Warteliste existiert, den frühesten Eintrag nachrücken
            IF current_registered_count < course_rec.max_participants THEN
                SELECT * INTO waitlist_rec
                FROM public.course_registrations
                WHERE course_id = NEW.course_id 
                  AND status = 'waitlist'
                ORDER BY registered_at ASC
                LIMIT 1;
                
                IF FOUND THEN
                    -- Befördern
                    UPDATE public.course_registrations
                    SET status = 'registered',
                        updated_at = now()
                    WHERE id = waitlist_rec.id;

                    -- Ereignis für Benachrichtigung protokollieren
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
                    
                    -- Zusätzlich: Webhook-Dispatch-Funktion aufrufen
                    PERFORM http((
                        'POST',
                        current_setting('app.settings.supabase_url') || '/functions/v1/dispatch-waitlist-promotion-events',
                        ARRAY[
                            http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
                            http_header('Content-Type', 'application/json')
                        ],
                        '{}'::text
                    ));
                END IF;
            END IF;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Fehler protokollieren, Transaktion nicht scheitern lassen
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