-- Fix the process_waitlists_on_cancellation function to remove pg_net dependency
CREATE OR REPLACE FUNCTION public.process_waitlists_on_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only process if status changed from registered/waitlist to cancelled
  IF OLD.status IN ('registered', 'waitlist') AND NEW.status = 'cancelled' THEN
    -- Instead of calling edge function directly, we'll handle waitlist processing here
    -- This avoids the pg_net dependency issue
    
    DECLARE
        course_rec RECORD;
        waitlist_rec RECORD;
        max_participants_count INTEGER;
        current_registered_count INTEGER;
    BEGIN
        -- Get course details
        SELECT * INTO course_rec FROM public.courses WHERE id = NEW.course_id;
        
        IF FOUND THEN
            -- Count current registered participants
            SELECT COUNT(*) INTO current_registered_count
            FROM public.course_registrations
            WHERE course_id = NEW.course_id AND status = 'registered';
            
            -- If there's space and there are people on waitlist, promote one
            IF current_registered_count < course_rec.max_participants THEN
                -- Get the earliest waitlisted person
                SELECT * INTO waitlist_rec
                FROM public.course_registrations
                WHERE course_id = NEW.course_id 
                  AND status = 'waitlist'
                ORDER BY registered_at ASC
                LIMIT 1;
                
                -- Promote from waitlist to registered
                IF FOUND THEN
                    UPDATE public.course_registrations
                    SET status = 'registered',
                        updated_at = now()
                    WHERE id = waitlist_rec.id;
                END IF;
            END IF;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log error but don't fail the transaction
            RAISE WARNING 'Error processing waitlist: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$