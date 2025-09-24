-- Fix the functions to use the correct get_weekly_registrations_count signature
-- The function only accepts user_id_param and uses current date by default
CREATE OR REPLACE FUNCTION public.can_user_register_for_course(user_id_param uuid, course_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
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
        -- Use function with single parameter (uses current date by default)
        weekly_count := get_weekly_registrations_count(user_id_param);
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

-- Fix the debug function too
CREATE OR REPLACE FUNCTION public.debug_can_user_register_for_course(user_id_param uuid, course_id_param uuid)
RETURNS TABLE(
    user_role TEXT,
    user_membership_type TEXT,
    weekly_count INTEGER,
    user_credits INTEGER,
    course_date DATE,
    can_register BOOLEAN,
    debug_info TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    _user_role TEXT;
    _user_membership_type TEXT;
    _weekly_count INTEGER;
    _user_credits INTEGER;
    _course_date DATE;
    _can_register BOOLEAN := TRUE;
    _debug_info TEXT := '';
BEGIN
    -- Get user role and membership type
    SELECT ur.role::TEXT, p.membership_type
    INTO _user_role, _user_membership_type
    FROM public.user_roles ur
    JOIN public.profiles p ON ur.user_id = p.user_id
    WHERE ur.user_id = user_id_param
    LIMIT 1;
    
    _debug_info := _debug_info || 'Role: ' || COALESCE(_user_role, 'NULL') || ', MemType: ' || COALESCE(_user_membership_type, 'NULL') || '; ';
    
    -- Get course date
    SELECT c.course_date INTO _course_date
    FROM public.courses c
    WHERE c.id = course_id_param;
    
    _debug_info := _debug_info || 'CourseDate: ' || COALESCE(_course_date::TEXT, 'NULL') || '; ';
    
    -- Admin and trainers can always register
    IF _user_role IN ('admin', 'trainer') THEN
        _debug_info := _debug_info || 'Admin/Trainer bypass; ';
        RETURN QUERY SELECT _user_role, _user_membership_type, _weekly_count, _user_credits, _course_date, _can_register, _debug_info;
        RETURN;
    END IF;
    
    -- Check Basic Member weekly limit
    IF _user_membership_type = 'Basic Member' THEN
        -- Use function with single parameter (uses current date by default)
        _weekly_count := get_weekly_registrations_count(user_id_param);
        _debug_info := _debug_info || 'WeeklyCount: ' || COALESCE(_weekly_count::TEXT, 'NULL') || '; ';
        IF _weekly_count >= 2 THEN
            _can_register := FALSE;
            _debug_info := _debug_info || 'BasicMember limit exceeded; ';
        END IF;
    END IF;
    
    -- Check 10er Karte credits
    IF _user_membership_type = '10er Karte' THEN
        SELECT credits_remaining INTO _user_credits
        FROM public.membership_credits
        WHERE user_id = user_id_param;
        
        _debug_info := _debug_info || 'Credits: ' || COALESCE(_user_credits::TEXT, 'NULL') || '; ';
        
        IF COALESCE(_user_credits, 0) <= 0 THEN
            _can_register := FALSE;
            _debug_info := _debug_info || '10erKarte no credits; ';
        END IF;
    END IF;
    
    RETURN QUERY SELECT _user_role, _user_membership_type, _weekly_count, _user_credits, _course_date, _can_register, _debug_info;
END;
$$;