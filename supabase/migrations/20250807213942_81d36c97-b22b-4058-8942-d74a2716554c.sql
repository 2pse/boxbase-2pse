
-- 1) Ereignistabelle für automatische Wartelisten-Beförderungen
CREATE TABLE IF NOT EXISTS public.waitlist_promotion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL,
  course_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ NULL,
  payload JSONB NULL
);

-- Optionaler Index für schnelle Abfrage nicht benachrichtigter Events
CREATE INDEX IF NOT EXISTS idx_waitlist_promotion_events_pending
  ON public.waitlist_promotion_events (created_at)
  WHERE notified_at IS NULL;

-- 2) Trigger-Funktion erweitern: nach dem automatischen Nachrücken Event protokollieren
CREATE OR REPLACE FUNCTION public.process_waitlists_on_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;
