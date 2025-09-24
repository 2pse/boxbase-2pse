-- Drop the old function and create a new one that works with the new membership system
DROP FUNCTION IF EXISTS public.can_user_register_for_course(uuid, uuid);

CREATE OR REPLACE FUNCTION public.can_user_register_for_course(p_user_id uuid, p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_membership_type text;
  user_credits integer;
  course_max_participants integer;
  current_registrations integer;
  course_is_active boolean;
BEGIN
  -- Check course status first
  SELECT 
    c.max_participants,
    (c.status = 'active' AND NOT c.is_cancelled) as is_active
  INTO course_max_participants, course_is_active
  FROM public.courses c
  WHERE c.id = p_course_id;

  IF NOT course_is_active THEN
    RETURN false;
  END IF;

  -- Get user membership information from new system
  SELECT 
    mp.booking_type,
    COALESCE(um.remaining_credits, 0) as credits
  INTO user_membership_type, user_credits
  FROM public.user_memberships um
  JOIN public.membership_plans mp ON um.membership_plan_id = mp.id
  WHERE um.user_id = p_user_id AND um.status = 'active';

  -- If no active membership found in new system, check legacy system
  IF user_membership_type IS NULL THEN
    SELECT 
      CASE 
        WHEN mc.membership_type = 'unlimited' THEN 'unlimited'
        WHEN mc.membership_type = 'limited' THEN 'monthly_limit'
        WHEN mc.membership_type = 'credits' THEN 'credits'
        ELSE 'credits'
      END,
      COALESCE(mc.credits_remaining, 0)
    INTO user_membership_type, user_credits
    FROM public.membership_credits mc
    WHERE mc.user_id = p_user_id;
  END IF;

  -- Check user roles for special access
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id AND role IN ('admin', 'trainer')
  ) THEN
    user_membership_type := 'unlimited';
  END IF;

  -- Count current registrations
  SELECT COUNT(*)
  INTO current_registrations
  FROM public.course_registrations cr
  WHERE cr.course_id = p_course_id AND cr.status = 'registered';

  -- Check registration eligibility
  RETURN (
    -- Must have valid membership
    (user_membership_type IS NOT NULL) AND
    -- Either unlimited or has credits
    (user_membership_type IN ('unlimited', 'open_gym_only') OR 
     (user_membership_type IN ('monthly_limit', 'credits') AND COALESCE(user_credits, 0) > 0)) AND
    -- Course must have available spots
    current_registrations < COALESCE(course_max_participants, 0)
  );
END;
$function$;