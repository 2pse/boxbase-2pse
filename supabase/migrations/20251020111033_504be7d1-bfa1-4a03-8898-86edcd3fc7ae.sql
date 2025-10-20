-- Fix: Add p_action parameter back to handle_course_registration_credits
-- This was removed in a previous migration but is still used by frontend

CREATE OR REPLACE FUNCTION public.handle_course_registration_credits(
  p_user_id uuid, 
  p_course_id uuid,
  p_action text DEFAULT 'deduct'  -- 'deduct' | 'refund'
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
  new_credits integer;
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

  -- Determine action
  IF p_action = 'deduct' THEN
    -- Check if user has credits
    IF user_credits <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Keine Credits verfügbar'
      );
    END IF;
    
    new_credits := user_credits - 1;
  ELSIF p_action = 'refund' THEN
    -- Always allow refund (add credit back)
    new_credits := user_credits + 1;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid action: must be deduct or refund'
    );
  END IF;

  -- Update credits
  user_membership_data := jsonb_set(
    user_membership_data,
    '{remaining_credits}',
    to_jsonb(new_credits)
  );

  -- Update membership
  UPDATE public.user_memberships_v2
  SET 
    membership_data = user_membership_data,
    updated_at = now()
  WHERE id = user_membership_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN p_action = 'deduct' THEN 'Credit erfolgreich abgezogen'
      WHEN p_action = 'refund' THEN 'Credit zurückerstattet'
    END,
    'credits', new_credits,
    'previous_credits', user_credits
  );
END;
$function$;