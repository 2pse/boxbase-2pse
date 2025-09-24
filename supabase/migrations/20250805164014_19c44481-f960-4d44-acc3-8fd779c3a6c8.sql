-- Create function to handle course registration with limits
CREATE OR REPLACE FUNCTION public.handle_course_registration_with_limits()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
    
    -- Call the original waitlist advancement function
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'registered' AND NEW.status = 'cancelled' THEN
            PERFORM advance_waitlist(NEW.course_id);
        END IF;
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'waitlisted' THEN
            PERFORM advance_waitlist(NEW.course_id);
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Drop existing trigger and create new one
DROP TRIGGER IF EXISTS course_registration_change_trigger ON public.course_registrations;
CREATE TRIGGER course_registration_change_trigger
AFTER INSERT OR UPDATE ON public.course_registrations
FOR EACH ROW
EXECUTE FUNCTION public.handle_course_registration_with_limits();