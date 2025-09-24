-- Fix trigger problem: Remove ALL conflicting triggers and functions with CASCADE
-- There are multiple conflicting triggers calling advance_waitlist

-- Drop all existing triggers and functions that conflict with CASCADE
DROP FUNCTION IF EXISTS public.handle_course_registration_change() CASCADE;

-- Now recreate the single consolidated trigger function with proper UUID casting
CREATE OR REPLACE FUNCTION public.handle_course_registration_with_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    user_membership_type TEXT;
    week_start DATE;
BEGIN
    -- Only process inserts for new registrations
    IF TG_OP = 'INSERT' AND NEW.status IN ('registered', 'waitlisted') THEN
        -- Get user's membership type
        SELECT membership_type INTO user_membership_type
        FROM public.profiles
        WHERE user_id = NEW.user_id;
        
        -- Handle 10er Karte credit deduction
        IF user_membership_type = '10er Karte' THEN
            UPDATE public.membership_credits
            SET credits_remaining = credits_remaining - 1,
                updated_at = now()
            WHERE user_id = NEW.user_id;
        END IF;
        
        -- Handle Basic Member weekly tracking
        IF user_membership_type = 'Basic Member' THEN
            -- Calculate week start (Monday)
            SELECT course_date - EXTRACT(DOW FROM course_date)::INTEGER + 1
            INTO week_start
            FROM public.courses
            WHERE id = NEW.course_id;
            
            -- Insert or update weekly limit tracking
            INSERT INTO public.weekly_course_limits (user_id, week_start_date, registrations_count)
            VALUES (NEW.user_id, week_start, 1)
            ON CONFLICT (user_id, week_start_date)
            DO UPDATE SET 
                registrations_count = public.weekly_course_limits.registrations_count + 1,
                updated_at = now();
        END IF;
    END IF;
    
    -- Handle cancellations - restore credits/counts
    IF TG_OP = 'UPDATE' AND OLD.status IN ('registered', 'waitlisted') AND NEW.status = 'cancelled' THEN
        -- Get user's membership type
        SELECT membership_type INTO user_membership_type
        FROM public.profiles
        WHERE user_id = NEW.user_id;
        
        -- Restore 10er Karte credit
        IF user_membership_type = '10er Karte' THEN
            UPDATE public.membership_credits
            SET credits_remaining = credits_remaining + 1,
                updated_at = now()
            WHERE user_id = NEW.user_id;
        END IF;
        
        -- Restore Basic Member weekly count
        IF user_membership_type = 'Basic Member' THEN
            -- Calculate week start (Monday)
            SELECT course_date - EXTRACT(DOW FROM course_date)::INTEGER + 1
            INTO week_start
            FROM public.courses
            WHERE id = NEW.course_id;
            
            -- Decrease weekly count
            UPDATE public.weekly_course_limits
            SET registrations_count = GREATEST(0, registrations_count - 1),
                updated_at = now()
            WHERE user_id = NEW.user_id AND week_start_date = week_start;
        END IF;
    END IF;
    
    -- Call the waitlist advancement function with explicit UUID casting
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'registered' AND NEW.status = 'cancelled' THEN
            -- Explicit UUID casting to prevent type errors
            PERFORM advance_waitlist(NEW.course_id::uuid);
        END IF;
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'waitlisted' THEN
            -- Explicit UUID casting to prevent type errors  
            PERFORM advance_waitlist(NEW.course_id::uuid);
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$function$;

-- Create a single consolidated trigger for all operations
CREATE TRIGGER course_registration_with_limits_trigger
    AFTER INSERT OR UPDATE ON public.course_registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_course_registration_with_limits();