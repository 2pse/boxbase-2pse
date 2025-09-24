-- Update can_user_register_for_course function to support v2 system
CREATE OR REPLACE FUNCTION public.can_user_register_for_course_v2(p_user_id uuid, p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_membership_type text;
  user_credits integer;
  course_max_participants integer;
  current_registrations integer;
  course_is_active boolean;
  booking_rules jsonb;
  membership_data jsonb;
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

  -- Count current registrations
  SELECT COUNT(*)
  INTO current_registrations
  FROM public.course_registrations cr
  WHERE cr.course_id = p_course_id AND cr.status = 'registered';

  -- Check if course is full
  IF current_registrations >= COALESCE(course_max_participants, 0) THEN
    RETURN false;
  END IF;

  -- First check new v2 system
  SELECT 
    mp2.booking_rules,
    um2.membership_data
  INTO booking_rules, membership_data
  FROM public.user_memberships_v2 um2
  JOIN public.membership_plans_v2 mp2 ON um2.membership_plan_id = mp2.id
  WHERE um2.user_id = p_user_id AND um2.status = 'active';

  IF booking_rules IS NOT NULL THEN
    -- Handle v2 system
    IF booking_rules->>'type' = 'unlimited' THEN
      RETURN true;
    ELSIF booking_rules->>'type' = 'open_gym_only' THEN
      RETURN false;
    ELSIF booking_rules->>'type' = 'credits' THEN
      user_credits := COALESCE((membership_data->>'remaining_credits')::integer, 0);
      RETURN user_credits > 0;
    ELSIF booking_rules->>'type' = 'limited' THEN
      -- Check period limits for limited memberships
      DECLARE
        limit_count integer := COALESCE((booking_rules->'limit'->>'count')::integer, 0);
        limit_period text := booking_rules->'limit'->>'period';
        period_start timestamp;
        used_in_period integer;
      BEGIN
        -- Calculate period start
        IF limit_period = 'week' THEN
          period_start := date_trunc('week', now()) + interval '1 day'; -- Monday
        ELSE
          period_start := date_trunc('month', now());
        END IF;

        -- Count registrations in current period
        SELECT COUNT(*)
        INTO used_in_period
        FROM public.course_registrations cr
        WHERE cr.user_id = p_user_id 
          AND cr.status = 'registered'
          AND cr.registered_at >= period_start;

        RETURN used_in_period < limit_count;
      END;
    END IF;
  END IF;

  -- Fallback to legacy v1 system
  SELECT 
    mp.booking_type,
    COALESCE(um.remaining_credits, 0)
  INTO user_membership_type, user_credits
  FROM public.user_memberships um
  JOIN public.membership_plans mp ON um.membership_plan_id = mp.id
  WHERE um.user_id = p_user_id AND um.status = 'active';

  -- If no membership found in new system, check legacy system
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

  -- Check registration eligibility
  RETURN (
    -- Must have valid membership
    (user_membership_type IS NOT NULL) AND
    -- Either unlimited or has credits
    (user_membership_type IN ('unlimited', 'open_gym_only') OR 
     (user_membership_type IN ('monthly_limit', 'credits') AND COALESCE(user_credits, 0) > 0))
  );
END;
$$;