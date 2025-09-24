-- Fix Vanessa's status and update the trigger function to handle both statuses
UPDATE course_registrations 
SET status = 'waitlisted' 
WHERE status = 'waitlist';

-- Update the advance_waitlist function to handle both 'waitlist' and 'waitlisted' status
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
    
    -- Advance waitlist users if spots are available (handle both 'waitlisted' and 'waitlist')
    WHILE available_spots > 0 LOOP
        -- Get the oldest waitlist entry (check both status values)
        SELECT * INTO waitlist_user_record
        FROM public.course_registrations
        WHERE course_id = course_id_param AND status IN ('waitlisted', 'waitlist')
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

-- Update the trigger function to handle both statuses
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
        IF NEW.status IN ('waitlisted', 'waitlist') THEN
            RAISE NOTICE 'User added to waitlist, checking for available spots in course %', NEW.course_id;
            PERFORM advance_waitlist(NEW.course_id);
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$function$;