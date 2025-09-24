-- Create function to get user's weekly registration count
CREATE OR REPLACE FUNCTION public.get_weekly_registrations_count(user_id_param UUID, check_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER 
LANGUAGE plpgsql 
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    week_start DATE;
    reg_count INTEGER;
BEGIN
    -- Calculate start of week (Monday)
    week_start := check_date - EXTRACT(DOW FROM check_date)::INTEGER + 1;
    
    -- Count non-cancelled registrations in the current week
    SELECT COUNT(*) INTO reg_count
    FROM public.course_registrations cr
    JOIN public.courses c ON cr.course_id = c.id
    WHERE cr.user_id = user_id_param
      AND cr.status IN ('registered', 'waitlisted')
      AND c.course_date >= week_start
      AND c.course_date < week_start + INTERVAL '7 days';
    
    RETURN COALESCE(reg_count, 0);
END;
$$;

-- Create function to check if user can register for course
CREATE OR REPLACE FUNCTION public.can_user_register_for_course(user_id_param UUID, course_id_param UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    user_role app_role;
    user_membership_type TEXT;
    weekly_count INTEGER;
    user_credits INTEGER;
    course_date DATE;
BEGIN
    -- Get user role and membership type
    SELECT ur.role, p.membership_type
    INTO user_role, user_membership_type
    FROM public.user_roles ur
    JOIN public.profiles p ON ur.user_id = p.user_id
    WHERE ur.user_id = user_id_param
    LIMIT 1;
    
    -- Get course date
    SELECT c.course_date INTO course_date
    FROM public.courses c
    WHERE c.id = course_id_param;
    
    -- Admin and trainers can always register
    IF user_role IN ('admin', 'trainer') THEN
        RETURN TRUE;
    END IF;
    
    -- Check Basic Member weekly limit
    IF user_membership_type = 'Basic Member' THEN
        weekly_count := get_weekly_registrations_count(user_id_param, course_date);
        IF weekly_count >= 2 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check 10er Karte credits
    IF user_membership_type = '10er Karte' THEN
        SELECT credits_remaining INTO user_credits
        FROM public.membership_credits
        WHERE user_id = user_id_param;
        
        IF COALESCE(user_credits, 0) <= 0 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$;