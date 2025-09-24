-- Phase 1: Fix RX'D Credits (Critical)
-- Initialize all RX'D memberships with 12 credits in membership_data
UPDATE user_memberships_v2 
SET membership_data = jsonb_set(
  COALESCE(membership_data, '{}'),
  '{remaining_credits}',
  '12'
)
WHERE membership_plan_id IN (
  SELECT id FROM membership_plans_v2 
  WHERE booking_rules->>'type' = 'limited'
  AND name ILIKE '%RX%D%'
)
AND (membership_data->>'remaining_credits' IS NULL OR (membership_data->>'remaining_credits')::integer = 0);

-- Phase 2: Create function for credit renewal
CREATE OR REPLACE FUNCTION public.renew_membership_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Renew credits for limited memberships (weekly and monthly)
  UPDATE user_memberships_v2
  SET 
    membership_data = jsonb_set(
      membership_data,
      '{remaining_credits}',
      to_jsonb((mp.booking_rules->'limit'->>'count')::integer)
    ),
    updated_at = now()
  FROM membership_plans_v2 mp
  WHERE user_memberships_v2.membership_plan_id = mp.id
    AND user_memberships_v2.status = 'active'
    AND mp.booking_rules->>'type' = 'limited'
    -- Only renew if contract is still valid (end_date in future or auto_renewal enabled)
    AND (user_memberships_v2.end_date > CURRENT_DATE OR user_memberships_v2.auto_renewal = true);

  -- Log the renewal
  RAISE NOTICE 'Credit renewal completed at %', now();
END;
$$;

-- Phase 3: Enhanced course registration function
CREATE OR REPLACE FUNCTION public.can_user_register_for_course_enhanced(p_user_id uuid, p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      RETURN true;
    ELSIF booking_rules->>'type' = 'open_gym_only' THEN
      RETURN false;
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

          -- Check if course is in future period
          IF limit_period = 'week' THEN
            is_future_period := course_date >= current_period_start + interval '1 week';
          ELSE
            is_future_period := course_date >= current_period_start + interval '1 month';
          END IF;

          -- If future period, check if membership will still be valid
          IF is_future_period THEN
            -- Check if membership will be valid at course date
            IF membership_end_date > course_date OR membership_auto_renewal THEN
              RETURN true; -- Can register for future period if membership is valid
            ELSE
              RETURN false; -- Membership expires before course date
            END IF;
          ELSE
            -- Current period: check credits AND period limits
            IF user_credits <= 0 THEN
              RETURN false;
            END IF;
            
            -- Count registrations in current period
            SELECT COUNT(*)
            INTO used_in_period
            FROM public.course_registrations cr
            JOIN public.courses c ON cr.course_id = c.id
            WHERE cr.user_id = p_user_id 
              AND cr.status = 'registered'
              AND c.course_date >= current_period_start
              AND c.course_date < CASE 
                WHEN limit_period = 'week' THEN current_period_start + interval '1 week'
                ELSE current_period_start + interval '1 month'
              END;

            RETURN used_in_period < limit_count;
          END IF;
        END;
      ELSE
        -- Pure credits system - just check credits
        RETURN user_credits > 0;
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
    RETURN true;
  END IF;

  -- Legacy v1 system logic
  RETURN (
    (user_membership_type IS NOT NULL) AND
    (user_membership_type IN ('unlimited', 'open_gym_only') OR 
     (user_membership_type IN ('monthly_limit', 'credits') AND COALESCE(user_credits, 0) > 0))
  );
END;
$$;

-- Phase 4: Fix login tracking
-- Create improved login trigger that handles edge cases
CREATE OR REPLACE FUNCTION public.handle_user_login_improved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only update if there's an actual login event
  IF NEW.last_sign_in_at IS NOT NULL AND (OLD.last_sign_in_at IS NULL OR NEW.last_sign_in_at > OLD.last_sign_in_at) THEN
    UPDATE public.profiles
    SET 
      last_login_at = NEW.last_sign_in_at,
      status = CASE 
        WHEN NEW.last_sign_in_at > now() - interval '90 days' THEN 'active'
        ELSE 'inactive'
      END,
      updated_at = now()
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Replace the existing trigger
DROP TRIGGER IF EXISTS handle_user_login_trigger ON auth.users;
CREATE TRIGGER handle_user_login_trigger
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_login_improved();

-- Sync existing login data from auth.users to profiles
UPDATE public.profiles 
SET 
  last_login_at = auth_users.last_sign_in_at,
  status = CASE 
    WHEN auth_users.last_sign_in_at IS NOT NULL AND auth_users.last_sign_in_at > now() - interval '90 days' THEN 'active'
    ELSE 'inactive'
  END,
  updated_at = now()
FROM auth.users auth_users
WHERE profiles.user_id = auth_users.id
  AND (profiles.last_login_at IS NULL OR profiles.last_login_at != auth_users.last_sign_in_at);

-- Set up cron job for credit renewal (weekly on Mondays and monthly on 1st)
-- Weekly renewal (every Monday at 6 AM)
SELECT cron.schedule(
  'weekly-credit-renewal',
  '0 6 * * 1',
  $$SELECT public.renew_membership_credits();$$
);

-- Monthly renewal (1st of every month at 6 AM)  
SELECT cron.schedule(
  'monthly-credit-renewal',
  '0 6 1 * *',
  $$SELECT public.renew_membership_credits();$$
);