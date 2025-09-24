-- Phase 1: Datenbereinigung und Konsistenz
-- Standardisiere alle Status-Werte und befördere Vanessa automatisch
UPDATE course_registrations 
SET status = 'waitlisted' 
WHERE status = 'waitlist';

-- Phase 2 & 3: Verbesserte advance_waitlist Funktion mit Transaktions-Sicherheit
CREATE OR REPLACE FUNCTION public.advance_waitlist(course_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    available_spots INTEGER;
    max_spots INTEGER;
    registered_count INTEGER;
    waitlist_user_record RECORD;
    promoted_count INTEGER := 0;
BEGIN
    -- Start transaction
    BEGIN
        -- Get course details with row lock
        SELECT max_participants INTO max_spots
        FROM public.courses
        WHERE id = course_id_param
        FOR UPDATE;
        
        IF max_spots IS NULL THEN
            RAISE NOTICE 'Course not found: %', course_id_param;
            RETURN;
        END IF;
        
        -- Count current registered participants
        SELECT COUNT(*) INTO registered_count
        FROM public.course_registrations
        WHERE course_id = course_id_param AND status = 'registered';
        
        -- Calculate available spots
        available_spots := max_spots - registered_count;
        
        RAISE NOTICE 'Course %, Max: %, Registered: %, Available: %', 
            course_id_param, max_spots, registered_count, available_spots;
        
        -- Advance waitlist users if spots are available
        WHILE available_spots > 0 LOOP
            -- Get the oldest waitlist entry with row lock to prevent race conditions
            SELECT * INTO waitlist_user_record
            FROM public.course_registrations
            WHERE course_id = course_id_param AND status = 'waitlisted'
            ORDER BY registered_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED;
            
            -- Exit if no waitlist users
            EXIT WHEN waitlist_user_record IS NULL;
            
            RAISE NOTICE 'Promoting user % from waitlist to registered', waitlist_user_record.user_id;
            
            -- Promote waitlist user to registered
            UPDATE public.course_registrations
            SET status = 'registered', updated_at = now()
            WHERE id = waitlist_user_record.id;
            
            available_spots := available_spots - 1;
            promoted_count := promoted_count + 1;
        END LOOP;
        
        RAISE NOTICE 'Advanced % users from waitlist for course %', promoted_count, course_id_param;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Error in advance_waitlist: %', SQLERRM;
            RAISE;
    END;
END;
$function$;

-- Phase 4: Verbesserte Trigger-Funktion
CREATE OR REPLACE FUNCTION public.handle_course_registration_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Handle UPDATE: if someone cancelled their registration, advance waitlist
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'registered' AND NEW.status = 'cancelled' THEN
            RAISE NOTICE 'User cancelled registration, advancing waitlist for course %', NEW.course_id;
            PERFORM advance_waitlist(NEW.course_id);
        END IF;
        RETURN NEW;
    END IF;
    
    -- Handle INSERT: if someone got added to waitlist, check if spots are available
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'waitlisted' THEN
            RAISE NOTICE 'User added to waitlist, checking for available spots in course %', NEW.course_id;
            PERFORM advance_waitlist(NEW.course_id);
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$function$;

-- Recreate trigger to ensure it's working
DROP TRIGGER IF EXISTS course_registration_trigger ON course_registrations;

CREATE TRIGGER course_registration_trigger
    AFTER INSERT OR UPDATE ON course_registrations
    FOR EACH ROW
    EXECUTE FUNCTION handle_course_registration_change();

-- Führe advance_waitlist für alle Kurse aus, um sicherzustellen dass alle Wartelisten korrekt verarbeitet werden
DO $$
DECLARE
    course_record RECORD;
BEGIN
    FOR course_record IN 
        SELECT DISTINCT course_id 
        FROM course_registrations 
        WHERE status = 'waitlisted'
    LOOP
        PERFORM advance_waitlist(course_record.course_id);
    END LOOP;
END $$;