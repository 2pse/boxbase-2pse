-- Step 1: Initialize membership_data for existing limited memberships
UPDATE user_memberships_v2
SET membership_data = jsonb_build_object(
  'remaining_credits', (
    SELECT (mp.booking_rules->'limit'->>'count')::integer
    FROM membership_plans_v2 mp
    WHERE mp.id = user_memberships_v2.membership_plan_id
  ),
  'credits_renewed_at', user_memberships_v2.start_date,
  'next_renewal_date', user_memberships_v2.start_date + interval '1 month'
)
WHERE status = 'active'
  AND membership_plan_id IN (
    SELECT id FROM membership_plans_v2 
    WHERE booking_rules->>'type' = 'limited'
  )
  AND (membership_data = '{}' OR membership_data->>'remaining_credits' IS NULL);

-- Step 2: Create function to renew credits
CREATE OR REPLACE FUNCTION public.renew_limited_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  membership_record record;
  new_credits integer;
BEGIN
  FOR membership_record IN
    SELECT 
      um.id,
      um.user_id,
      um.membership_plan_id,
      um.membership_data,
      um.start_date,
      mp.booking_rules
    FROM user_memberships_v2 um
    JOIN membership_plans_v2 mp ON um.membership_plan_id = mp.id
    WHERE um.status = 'active'
      AND mp.booking_rules->>'type' = 'limited'
      AND (um.membership_data->>'next_renewal_date')::date <= CURRENT_DATE
  LOOP
    -- Get credits from booking rules
    new_credits := (membership_record.booking_rules->'limit'->>'count')::integer;
    
    -- Update membership_data
    UPDATE user_memberships_v2
    SET 
      membership_data = jsonb_build_object(
        'remaining_credits', new_credits,
        'credits_renewed_at', CURRENT_DATE,
        'next_renewal_date', CURRENT_DATE + interval '1 month'
      ),
      updated_at = now()
    WHERE id = membership_record.id;
    
    RAISE NOTICE 'Renewed credits for user % to %', membership_record.user_id, new_credits;
  END LOOP;
END;
$$;

-- Step 3: Create trigger function to check and renew before registration
CREATE OR REPLACE FUNCTION public.check_and_renew_credits_before_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has limited membership that needs renewal
  PERFORM public.renew_limited_credits();
  
  RETURN NEW;
END;
$$;

-- Step 4: Create trigger on course_registrations
DROP TRIGGER IF EXISTS trigger_renew_credits_before_registration ON course_registrations;
CREATE TRIGGER trigger_renew_credits_before_registration
  BEFORE INSERT ON course_registrations
  FOR EACH STATEMENT
  EXECUTE FUNCTION check_and_renew_credits_before_registration();

-- Step 5: Update can_user_register_for_course_enhanced to check credits for limited
CREATE OR REPLACE FUNCTION public.can_user_register_for_course_enhanced(p_user_id uuid, p_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
      IF current_registrations >= COALESCE(course_max_participants, 0) THEN
        RETURN '{"canRegister": false, "canWaitlist": true}'::jsonb;
      ELSE
        RETURN '{"canRegister": true, "canWaitlist": false}'::jsonb;
      END IF;
    ELSIF booking_rules->>'type' = 'open_gym_only' THEN
      RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
    ELSIF booking_rules->>'type' = 'credits' OR booking_rules->>'type' = 'limited' THEN
      -- Both credits and limited memberships now use credits system
      user_credits := COALESCE((membership_data->>'remaining_credits')::integer, 0);
      
      -- Check if membership will still be valid at course date (only for limited)
      IF booking_rules->>'type' = 'limited' AND membership_end_date IS NOT NULL AND membership_end_date < course_date AND NOT membership_auto_renewal THEN
        RETURN '{"canRegister": false, "canWaitlist": false}'::jsonb;
      END IF;

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
$$;

-- Step 6: Update handle_course_registration_credits to handle limited memberships
CREATE OR REPLACE FUNCTION public.handle_course_registration_credits(p_user_id uuid, p_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_membership_id uuid;
  user_credits integer;
  booking_rules jsonb;
  user_membership_data jsonb;
BEGIN
  -- Get active V2 membership
  SELECT 
    um2.id,
    mp2.booking_rules,
    um2.membership_data
  INTO user_membership_id, booking_rules, user_membership_data
  FROM public.user_memberships_v2 um2
  JOIN public.membership_plans_v2 mp2 ON um2.membership_plan_id = mp2.id
  WHERE um2.user_id = p_user_id 
    AND um2.status = 'active';

  -- If no V2 membership found
  IF user_membership_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Keine aktive Mitgliedschaft gefunden'
    );
  END IF;

  -- Skip credit management for unlimited and open_gym_only
  IF booking_rules->>'type' = 'unlimited' OR booking_rules->>'type' = 'open_gym_only' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Membership type does not use credits',
      'credits', 0
    );
  END IF;

  -- Process credits for 'credits' AND 'limited' membership types
  user_credits := COALESCE((user_membership_data->>'remaining_credits')::integer, 0);

  -- Check if user has credits
  IF user_credits <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Keine Credits verfügbar'
    );
  END IF;

  -- Deduct credit
  user_membership_data := jsonb_set(
    user_membership_data,
    '{remaining_credits}',
    to_jsonb(user_credits - 1)
  );

  -- Update membership
  UPDATE public.user_memberships_v2
  SET 
    membership_data = user_membership_data,
    updated_at = now()
  WHERE id = user_membership_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Credit erfolgreich abgezogen',
    'credits', user_credits - 1
  );
END;
$$;