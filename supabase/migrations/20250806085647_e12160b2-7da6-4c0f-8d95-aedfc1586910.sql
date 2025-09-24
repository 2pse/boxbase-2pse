-- Recreate the advance_waitlist function that seems to be missing
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