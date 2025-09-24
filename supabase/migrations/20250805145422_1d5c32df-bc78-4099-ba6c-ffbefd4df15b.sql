-- Debug and fix the waitlist advancement trigger
-- First, let's check if the trigger exists and recreate it properly

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS course_registration_change_trigger ON public.course_registrations;

-- Recreate the trigger to fire AFTER UPDATE
CREATE TRIGGER course_registration_change_trigger
    AFTER UPDATE ON public.course_registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_course_registration_change();

-- Also create a trigger for INSERT in case someone gets added to a full course
CREATE OR REPLACE TRIGGER course_registration_insert_trigger
    AFTER INSERT ON public.course_registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_course_registration_change();

-- Update the advance_waitlist function to be more robust
CREATE OR REPLACE FUNCTION public.advance_waitlist(course_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    available_spots INTEGER;
    max_spots INTEGER;
    registered_count INTEGER;
    waitlist_user_record RECORD;
BEGIN
    -- Get course details
    SELECT max_participants INTO max_spots
    FROM public.courses
    WHERE id = course_id_param;
    
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
    
    RAISE NOTICE 'Course %, Max: %, Registered: %, Available: %', course_id_param, max_spots, registered_count, available_spots;
    
    -- Advance waitlist users if spots are available
    WHILE available_spots > 0 LOOP
        -- Get the oldest waitlist entry
        SELECT * INTO waitlist_user_record
        FROM public.course_registrations
        WHERE course_id = course_id_param AND status = 'waitlisted'
        ORDER BY registered_at ASC
        LIMIT 1;
        
        -- Exit if no waitlist users
        EXIT WHEN waitlist_user_record IS NULL;
        
        RAISE NOTICE 'Promoting user % from waitlist to registered', waitlist_user_record.user_id;
        
        -- Promote waitlist user to registered
        UPDATE public.course_registrations
        SET status = 'registered', updated_at = now()
        WHERE id = waitlist_user_record.id;
        
        available_spots := available_spots - 1;
    END LOOP;
END;
$function$;

-- Update the trigger function to handle both INSERT and UPDATE
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