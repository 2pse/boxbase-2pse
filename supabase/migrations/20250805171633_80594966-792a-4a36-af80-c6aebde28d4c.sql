-- Recreate the get_weekly_registrations_count function if needed
CREATE OR REPLACE FUNCTION public.get_weekly_registrations_count(user_id_param uuid, check_date date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
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