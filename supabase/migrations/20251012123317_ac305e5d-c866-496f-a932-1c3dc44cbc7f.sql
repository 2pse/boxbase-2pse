-- Period-Based Credits System for LIMITED memberships
-- Remove stored remaining_credits as we will calculate them dynamically based on booking period

-- Set remaining_credits to 999 as indicator that we use period-based calculation
UPDATE user_memberships_v2
SET membership_data = jsonb_set(
  membership_data,
  '{remaining_credits}',
  '999'::jsonb
),
updated_at = now()
WHERE status = 'active'
  AND membership_plan_id IN (
    SELECT id FROM membership_plans_v2 
    WHERE booking_rules->>'type' = 'limited'
  );

-- Update handle_course_registration_credits to skip credit deduction for LIMITED memberships
CREATE OR REPLACE FUNCTION public.handle_course_registration_credits(p_user_id uuid, p_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Skip credit management for unlimited, open_gym_only, AND limited
  -- Limited memberships use period-based calculation, not stored credits
  IF booking_rules->>'type' IN ('unlimited', 'open_gym_only', 'limited') THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Membership type uses period-based limits or is unlimited',
      'credits', 0
    );
  END IF;

  -- Process credits ONLY for 'credits' membership type
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
$function$;

-- Update renew_limited_credits to only run for credits type (not limited)
-- Limited memberships don't need renewal as they use period-based calculation
CREATE OR REPLACE FUNCTION public.renew_limited_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  membership_record record;
  new_credits integer;
BEGIN
  -- Only renew for 'credits' type memberships, not 'limited'
  -- Limited memberships use period-based calculation
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
      AND mp.booking_rules->>'type' = 'credits'
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
$function$;