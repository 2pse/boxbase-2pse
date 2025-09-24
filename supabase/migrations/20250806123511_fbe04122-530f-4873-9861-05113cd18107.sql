-- Update the can_user_register_for_course function to use course_date for weekly limits
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
        -- Use the course date instead of current date for weekly count
        weekly_count := get_weekly_registrations_count(user_id_param::uuid, course_date::date);
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
$function$