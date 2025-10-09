-- Modify handle_course_registration_credits to skip limited memberships
CREATE OR REPLACE FUNCTION public.handle_course_registration_credits(
  p_user_id uuid,
  p_course_id uuid
)
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

  -- Skip credit management for unlimited and open_gym_only
  IF booking_rules->>'type' = 'unlimited' OR booking_rules->>'type' = 'open_gym_only' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Membership type does not use credits',
      'credits', 0
    );
  END IF;

  -- Skip credit management for limited memberships (period-based, not credit-based)
  IF booking_rules->>'type' = 'limited' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Limited membership does not use credit tracking',
      'credits', 0
    );
  END IF;

  -- Only process credits for 'credits' membership type
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