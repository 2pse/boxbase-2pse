-- Fix Limited Membership tracking to include Open Gym sessions
-- Update can_user_register_for_course_enhanced to count both course registrations AND free_training sessions

CREATE OR REPLACE FUNCTION public.can_user_register_for_course_enhanced(p_user_id uuid, p_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_credits integer;
  course_max_participants integer;
  current_registrations integer;
  course_is_active boolean;
  course_date date;
  booking_rules jsonb;
  membership_data jsonb;
  membership_end_date date;
  membership_auto_renewal boolean;
  membership_start_date date;
  
  -- Period-based variables for limited memberships
  start_day integer;
  target_period_start date;
  target_period_end date;
  used_in_period integer;
  limit_count integer;
  limit_period text;
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
    um2.auto_renewal,
    um2.start_date
  INTO booking_rules, membership_data, membership_end_date, membership_auto_renewal, membership_start_date
  FROM public.user_memberships_v2 um2
  JOIN public.membership_plans_v2 mp2 ON um2.membership_plan_id = mp2.id
  WHERE um2.user_id = p_user_id AND um2.status = 'active';

  IF booking_rules IS NOT NULL THEN
    -- ========== CENTRAL EXPIRATION CHECK FOR ALL MEMBERSHIP TYPES ==========
    IF membership_end_date IS NOT NULL 
       AND membership_end_date < course_date 
       AND NOT COALESCE(membership_auto_renewal, false) THEN
      RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
    END IF;
    -- ========== END CENTRAL CHECK ==========
    
    -- Handle v2 system
    IF booking_rules->>'type' = 'unlimited' THEN
      IF current_registrations >= COALESCE(course_max_participants, 0) THEN
        RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
      ELSE
        RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
      END IF;
      
    ELSIF booking_rules->>'type' = 'open_gym_only' THEN
      RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
      
    ELSIF booking_rules->>'type' = 'limited' THEN
      -- ========== PERIOD-BASED CALCULATION FOR LIMITED MEMBERSHIPS ==========
      -- Get limit configuration
      limit_count := COALESCE((booking_rules->'limit'->>'count')::integer, 0);
      limit_period := booking_rules->'limit'->>'period';
      
      -- Calculate target period based on membership start_date
      start_day := EXTRACT(DAY FROM membership_start_date)::integer;
      
      IF limit_period = 'week' THEN
        -- Weekly period calculation
        target_period_start := DATE_TRUNC('week', course_date) + interval '1 day'; -- Monday
        target_period_end := target_period_start + interval '6 days';
      ELSE
        -- Monthly period based on start_date
        target_period_start := DATE_TRUNC('month', course_date) + (start_day - 1 || ' days')::interval;
        
        IF EXTRACT(DAY FROM course_date)::integer < start_day THEN
          target_period_start := target_period_start - interval '1 month';
        END IF;
        
        target_period_end := (target_period_start + interval '1 month' - interval '1 day')::date;
      END IF;
      
      -- Count BOTH course registrations AND open gym sessions in period
      WITH period_activities AS (
        -- Course registrations
        SELECT c.course_date as activity_date
        FROM public.course_registrations cr
        JOIN public.courses c ON cr.course_id = c.id
        WHERE cr.user_id = p_user_id
          AND cr.status = 'registered'
          AND c.course_date >= target_period_start
          AND c.course_date <= target_period_end
        
        UNION ALL
        
        -- Open gym sessions (free_training)
        SELECT ts.session_date as activity_date
        FROM public.training_sessions ts
        WHERE ts.user_id = p_user_id
          AND ts.session_type = 'free_training'
          AND ts.status = 'completed'
          AND ts.session_date >= target_period_start::date
          AND ts.session_date <= target_period_end::date
      )
      SELECT COUNT(*) INTO used_in_period FROM period_activities;
      
      -- Calculate remaining credits dynamically
      user_credits := GREATEST(0, limit_count - used_in_period);
      
      -- Check if user has credits for this period
      IF user_credits <= 0 THEN
        RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
      END IF;
      
      -- Check if course is full
      IF current_registrations >= COALESCE(course_max_participants, 0) THEN
        RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
      ELSE
        RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
      END IF;
      
    ELSIF booking_rules->>'type' = 'credits' THEN
      -- Credits type uses stored remaining_credits
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
    END IF;
  END IF;

  -- Fallback to admin/trainer check
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id AND role IN ('admin', 'trainer')
  ) THEN
    IF current_registrations >= COALESCE(course_max_participants, 0) THEN
      RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
    ELSE
      RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
    END IF;
  END IF;

  RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
END;
$function$;