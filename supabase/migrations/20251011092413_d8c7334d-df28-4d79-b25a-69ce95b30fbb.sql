-- Fix membership_data initialization for LIMITED memberships
-- This migration ensures all active limited memberships have proper credit tracking

-- Initialize membership_data for LIMITED memberships that have empty or missing credits
UPDATE user_memberships_v2
SET membership_data = jsonb_build_object(
  'remaining_credits', (
    SELECT (mp2.booking_rules->'limit'->>'count')::integer
    FROM membership_plans_v2 mp2
    WHERE mp2.id = user_memberships_v2.membership_plan_id
  ),
  'credits_renewed_at', user_memberships_v2.start_date,
  'next_renewal_date', user_memberships_v2.start_date + interval '1 month'
),
updated_at = now()
WHERE status = 'active'
  AND membership_plan_id IN (
    SELECT id FROM membership_plans_v2 
    WHERE booking_rules->>'type' = 'limited'
  )
  AND (
    membership_data = '{}'::jsonb 
    OR membership_data = '[]'::jsonb
    OR membership_data->>'remaining_credits' IS NULL
  );