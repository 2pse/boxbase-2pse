-- Create a new RPC function for handling credit management during course registrations
CREATE OR REPLACE FUNCTION public.handle_course_registration_credits(
  p_user_id uuid,
  p_course_id uuid,
  p_action text -- 'deduct' or 'refund'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking_rules jsonb;
  membership_data jsonb;
  current_credits integer;
  new_credits integer;
  membership_id uuid;
  result jsonb;
BEGIN
  -- Get user's active membership from v2 system
  SELECT 
    um2.id,
    mp2.booking_rules,
    um2.membership_data
  INTO membership_id, booking_rules, membership_data
  FROM public.user_memberships_v2 um2
  JOIN public.membership_plans_v2 mp2 ON um2.membership_plan_id = mp2.id
  WHERE um2.user_id = p_user_id 
    AND um2.status = 'active'
  LIMIT 1;

  -- If no v2 membership found, return success (no credit management needed)
  IF membership_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'No credit management needed',
      'credits', 0
    );
  END IF;

  -- Only process credits for 'credits' and 'limited' membership types
  IF booking_rules->>'type' NOT IN ('credits', 'limited') THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Membership type does not use credits',
      'credits', 0
    );
  END IF;

  -- Get current credits
  current_credits := COALESCE((membership_data->>'remaining_credits')::integer, 0);

  -- Handle action
  IF p_action = 'deduct' THEN
    -- Check if user has enough credits
    IF current_credits <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Keine Credits verfügbar',
        'credits', current_credits
      );
    END IF;
    
    new_credits := current_credits - 1;
  ELSIF p_action = 'refund' THEN
    new_credits := current_credits + 1;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid action',
      'credits', current_credits
    );
  END IF;

  -- Update membership data
  UPDATE public.user_memberships_v2
  SET 
    membership_data = jsonb_set(
      membership_data,
      '{remaining_credits}',
      to_jsonb(new_credits)
    ),
    updated_at = now()
  WHERE id = membership_id;

  -- Return success with new credit count
  RETURN jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN p_action = 'deduct' THEN 'Credit abgezogen'
      WHEN p_action = 'refund' THEN 'Credit zurückerstattet'
    END,
    'credits', new_credits,
    'previous_credits', current_credits
  );
END;
$$;