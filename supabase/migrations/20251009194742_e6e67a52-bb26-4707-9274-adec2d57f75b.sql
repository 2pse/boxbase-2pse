-- Add RAISE NOTICE logging to can_user_register_for_course_enhanced for debugging
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

  RAISE NOTICE '[Registration Check] Course ID: %, Date: %, Active: %', p_course_id, course_date, course_is_active;

  IF NOT course_is_active THEN
    RAISE NOTICE '[Registration Check] BLOCKED: Course is not active';
    RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
  END IF;

  -- Count current registrations
  SELECT COUNT(*)
  INTO current_registrations
  FROM public.course_registrations cr
  WHERE cr.course_id = p_course_id AND cr.status = 'registered';

  RAISE NOTICE '[Registration Check] Current registrations: % / %', current_registrations, course_max_participants;

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
    RAISE NOTICE '[Registration Check] V2 Membership found. Type: %, Rules: %', booking_rules->>'type', booking_rules;
    
    -- Handle v2 system
    IF booking_rules->>'type' = 'unlimited' THEN
      -- Check if course is full for unlimited users
      IF current_registrations >= COALESCE(course_max_participants, 0) THEN
        RAISE NOTICE '[Registration Check] WAITLIST: Unlimited membership but course is full';
        RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
      ELSE
        RAISE NOTICE '[Registration Check] ALLOWED: Unlimited membership';
        RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
      END IF;
    ELSIF booking_rules->>'type' = 'open_gym_only' THEN
      RAISE NOTICE '[Registration Check] BLOCKED: Open Gym only membership';
      RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
    ELSIF booking_rules->>'type' = 'credits' THEN
      user_credits := COALESCE((membership_data->>'remaining_credits')::integer, 0);
      RAISE NOTICE '[Registration Check] Credits membership. Remaining: %', user_credits;
      
      -- Check credits
      IF user_credits <= 0 THEN
        RAISE NOTICE '[Registration Check] BLOCKED: No credits remaining';
        RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
      END IF;

      -- Check if course is full
      IF current_registrations >= COALESCE(course_max_participants, 0) THEN
        RAISE NOTICE '[Registration Check] WAITLIST: Has credits but course is full';
        RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
      ELSE
        RAISE NOTICE '[Registration Check] ALLOWED: Has credits and course has space';
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

        RAISE NOTICE '[Registration Check] Limited membership. Period: %, Count: %, Target period: % to %', 
          limit_period, limit_count, target_period_start, target_period_end;

        -- Check if membership will still be valid at course date
        IF membership_end_date IS NOT NULL AND membership_end_date < course_date AND NOT membership_auto_renewal THEN
          RAISE NOTICE '[Registration Check] BLOCKED: Membership expires before course date (% < %)', membership_end_date, course_date;
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

        RAISE NOTICE '[Registration Check] Limited membership check: used_in_period=% / limit=%', used_in_period, limit_count;

        -- Check period limit
        IF used_in_period >= limit_count THEN
          RAISE NOTICE '[Registration Check] BLOCKED: Period limit reached (% >= %)', used_in_period, limit_count;
          RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
        END IF;

        -- Check if course is full
        IF current_registrations >= COALESCE(course_max_participants, 0) THEN
          RAISE NOTICE '[Registration Check] WAITLIST: Has limit space but course is full';
          RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
        ELSE
          RAISE NOTICE '[Registration Check] ALLOWED: Has limit space and course has space';
          RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
        END IF;
      END;
    END IF;
  END IF;

  RAISE NOTICE '[Registration Check] No V2 membership found, checking V1 and roles';

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
    RAISE NOTICE '[Registration Check] Admin/Trainer detected';
    -- Check if course is full for admin/trainer
    IF current_registrations >= COALESCE(course_max_participants, 0) THEN
      RAISE NOTICE '[Registration Check] WAITLIST: Admin/Trainer but course is full';
      RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
    ELSE
      RAISE NOTICE '[Registration Check] ALLOWED: Admin/Trainer access';
      RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
    END IF;
  END IF;

  -- Legacy v1 system logic
  IF user_membership_type IS NULL THEN
    RAISE NOTICE '[Registration Check] BLOCKED: No membership found';
    RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
  END IF;

  RAISE NOTICE '[Registration Check] V1 membership: type=%, credits=%', user_membership_type, user_credits;

  -- Check v1 membership eligibility
  IF user_membership_type IN ('unlimited', 'open_gym_only') OR 
     (user_membership_type IN ('monthly_limit', 'credits') AND COALESCE(user_credits, 0) > 0) THEN
    -- Check if course is full
    IF current_registrations >= COALESCE(course_max_participants, 0) THEN
      RAISE NOTICE '[Registration Check] WAITLIST: V1 eligible but course is full';
      RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
    ELSE
      RAISE NOTICE '[Registration Check] ALLOWED: V1 eligible and course has space';
      RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
    END IF;
  ELSE
    RAISE NOTICE '[Registration Check] BLOCKED: V1 not eligible';
    RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
  END IF;
END;
$function$;