-- Replace the can_user_register_for_course function with a self-contained version
CREATE OR REPLACE FUNCTION public.can_user_register_for_course(user_id_param uuid, course_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    user_role TEXT;
    user_membership_type TEXT;
    weekly_count INTEGER;
    user_credits INTEGER;
    course_date DATE;
    week_start DATE;
BEGIN
    -- Get user role and membership type
    SELECT ur.role::TEXT, p.membership_type
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
        -- Calculate week start (Monday) for the course date
        week_start := course_date - EXTRACT(DOW FROM course_date)::INTEGER + 1;
        
        -- Count non-cancelled registrations in that week
        SELECT COUNT(*) INTO weekly_count
        FROM public.course_registrations cr
        JOIN public.courses c ON cr.course_id = c.id
        WHERE cr.user_id = user_id_param
          AND cr.status IN ('registered', 'waitlisted')
          AND c.course_date >= week_start
          AND c.course_date < week_start + INTERVAL '7 days';
        
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
$function$;