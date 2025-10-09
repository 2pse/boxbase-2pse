-- Fix can_user_register_for_course_enhanced to check course_date instead of registered_at
-- This ensures weekly/monthly limits are calculated based on the course week/month, not registration week/month

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
  is_future_period boolean := false;
  current_period_start date;
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
    ELSIF booking_rules->>'type' IN ('credits', 'limited') THEN
      user_credits := COALESCE((membership_data->>'remaining_credits')::integer, 0);
      
      -- Check if this is for a future period
      IF booking_rules->>'type' = 'limited' THEN
        DECLARE
          limit_period text := booking_rules->'limit'->>'period';
          limit_count integer := COALESCE((booking_rules->'limit'->>'count')::integer, 0);
          used_in_period integer;
        BEGIN
          -- Calculate current period start
          IF limit_period = 'week' THEN
            current_period_start := date_trunc('week', CURRENT_DATE) + interval '1 day'; -- Monday
          ELSE
            current_period_start := date_trunc('month', CURRENT_DATE);
          END IF;

          -- Calculate target period (period of the course) based on course_date
          IF limit_period = 'week' THEN
            target_period_start := date_trunc('week', course_date::timestamp) + interval '1 day'; -- Monday of course week
            target_period_end := target_period_start + interval '1 week';
          ELSE
            target_period_start := date_trunc('month', course_date::timestamp); -- First of course month
            target_period_end := target_period_start + interval '1 month';
          END IF;

          -- Check if course is in future period
          is_future_period := target_period_start >= current_period_start + CASE 
            WHEN limit_period = 'week' THEN interval '1 week'
            ELSE interval '1 month'
          END;

          -- If future period, check if membership will still be valid
          IF is_future_period THEN
            IF membership_end_date > course_date OR membership_auto_renewal THEN
              -- Check if course is full
              IF current_registrations >= COALESCE(course_max_participants, 0) THEN
                RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
              ELSE
                RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
              END IF;
            ELSE
              RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb; -- Membership expires before course date
            END IF;
          ELSE
            -- Current or same period: check credits AND period limits
            IF user_credits <= 0 THEN
              RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
            END IF;
            
            -- Count registrations in TARGET period (based on course_date, not registered_at)
            SELECT COUNT(*)
            INTO used_in_period
            FROM public.course_registrations cr
            JOIN public.courses c ON cr.course_id = c.id
            WHERE cr.user_id = p_user_id 
              AND cr.status = 'registered'
              AND c.course_date >= target_period_start
              AND c.course_date < target_period_end;

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
          END IF;
        END;
      ELSE
        -- Pure credits system - just check credits and course capacity
        IF user_credits <= 0 THEN
          RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
        END IF;

        -- Check if course is full
        IF current_registrations >= COALESCE(course_max_participants, 0) THEN
          RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
        ELSE
          RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
        END IF;
      END IF;
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