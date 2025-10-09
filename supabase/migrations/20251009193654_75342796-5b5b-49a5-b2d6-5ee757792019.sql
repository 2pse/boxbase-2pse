-- Fix can_user_register_for_course_enhanced: Remove future period check for Limited memberships
-- and clean up membership_data

-- First, clean up membership_data for Limited memberships
UPDATE user_memberships_v2
SET membership_data = '{}'::jsonb
WHERE membership_plan_id IN (
  SELECT id FROM membership_plans_v2 
  WHERE booking_rules->>'type' = 'limited'
)
AND (membership_data ? 'remaining_credits' OR membership_data = '{}'::jsonb);

-- Now fix the SQL function
CREATE OR REPLACE FUNCTION public.can_user_register_for_course_enhanced(p_user_id uuid, p_course_id uuid)
RETURNS jsonb
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
  course_date date;
  booking_rules jsonb;
  membership_data jsonb;
  membership_end_date date;
  membership_auto_renewal boolean;
  target_period_start date;
  target_period_end date;
BEGIN
  -- Check course status and get course date
  SELECT 
    c.max_participants,
    (c.status = 'active' AND NOT c.is_cancelled) as is_active,
    c.course_date
  INTO course_max_participants, course_is_active, course_date
  FROM public.courses c
  WHERE c.id = p_course_id;

  IF NOT course_is_active THEN
    RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
  END IF;

  -- Count current registrations
  SELECT COUNT(*)
  INTO current_registrations
  FROM public.course_registrations cr
  WHERE cr.course_id = p_course_id AND cr.status = 'registered';

  -- Get user's active v2 membership
  SELECT 
    mp2.booking_rules,
    um2.membership_data,
    um2.end_date,
    um2.auto_renewal
  INTO booking_rules, membership_data, membership_end_date, membership_auto_renewal
  FROM public.user_memberships_v2 um2
  JOIN public.membership_plans_v2 mp2 ON um2.membership_plan_id = mp2.id
  WHERE um2.user_id = p_user_id AND um2.status = 'active';

  IF booking_rules IS NOT NULL THEN
    -- Handle v2 system
    IF booking_rules->>'type' = 'unlimited' THEN
      -- Check if course is full for unlimited users
      IF current_registrations >= COALESCE(course_max_participants, 0) THEN
        RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
      ELSE
        RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
      END IF;
    ELSIF booking_rules->>'type' = 'open_gym_only' THEN
      RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
    ELSIF booking_rules->>'type' = 'credits' THEN
      user_credits := COALESCE((membership_data->>'remaining_credits')::integer, 0);
      
      -- Check credits
      IF user_credits <= 0 THEN
        RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
      END IF;

      -- Check if course is full
      IF current_registrations >= COALESCE(course_max_participants, 0) THEN
        RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
      ELSE
        RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
      END IF;
    ELSIF booking_rules->>'type' = 'limited' THEN
      -- Limited memberships: Check period limits dynamically for ANY period
      DECLARE
        limit_period text := booking_rules->'limit'->>'period';
        limit_count integer := COALESCE((booking_rules->'limit'->>'count')::integer, 0);
        used_in_period integer;
      BEGIN
        -- Calculate target period based on course_date
        IF limit_period = 'week' THEN
          target_period_start := date_trunc('week', course_date::timestamp)::date + 1; -- Monday
          target_period_end := target_period_start + 6; -- Sunday
        ELSE
          target_period_start := date_trunc('month', course_date::timestamp)::date;
          target_period_end := (date_trunc('month', course_date::timestamp) + interval '1 month' - interval '1 day')::date;
        END IF;

        -- Check if membership will still be valid at course date
        IF membership_end_date IS NOT NULL AND membership_end_date < course_date AND NOT membership_auto_renewal THEN
          RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
        END IF;

        -- Count registrations in TARGET period (based on course_date)
        SELECT COUNT(*)
        INTO used_in_period
        FROM public.course_registrations cr
        JOIN public.courses c ON cr.course_id = c.id
        WHERE cr.user_id = p_user_id 
          AND cr.status = 'registered'
          AND c.course_date >= target_period_start
          AND c.course_date <= target_period_end;

        -- Check period limit
        IF used_in_period >= limit_count THEN
          RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
        END IF;

        -- Check if course is full
        IF current_registrations >= COALESCE(course_max_participants, 0) THEN
          RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
        ELSE
          RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
        END IF;
      END;
    END IF;
  END IF;

  -- Fallback to v1 system or admin/trainer check
  SELECT 
    mp.booking_type,
    COALESCE(um.remaining_credits, 0)
  INTO user_membership_type, user_credits
  FROM public.user_memberships um
  JOIN public.membership_plans mp ON um.membership_plan_id = mp.id
  WHERE um.user_id = p_user_id AND um.status = 'active';

  -- Check user roles for special access
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id AND role IN ('admin', 'trainer')
  ) THEN
    -- Check if course is full for admin/trainer
    IF current_registrations >= COALESCE(course_max_participants, 0) THEN
      RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
    ELSE
      RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
    END IF;
  END IF;

  -- Legacy v1 system logic
  IF user_membership_type IS NULL THEN
    RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
  END IF;

  -- Check v1 membership eligibility
  IF user_membership_type IN ('unlimited', 'open_gym_only') OR 
     (user_membership_type IN ('monthly_limit', 'credits') AND COALESCE(user_credits, 0) > 0) THEN
    -- Check if course is full
    IF current_registrations >= COALESCE(course_max_participants, 0) THEN
      RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
    ELSE
      RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
    END IF;
  ELSE
    RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
  END IF;
END;
$function$;