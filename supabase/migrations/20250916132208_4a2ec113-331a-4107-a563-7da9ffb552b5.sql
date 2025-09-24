-- Update membership_data for limited memberships to have proper initial credit values
UPDATE user_memberships_v2 
SET membership_data = jsonb_build_object(
  'remaining_credits', 
  (mp2.booking_rules->'limit'->>'count')::integer
)
FROM membership_plans_v2 mp2
WHERE user_memberships_v2.membership_plan_id = mp2.id
  AND user_memberships_v2.status = 'active'
  AND mp2.booking_rules->>'type' = 'limited'
  AND (user_memberships_v2.membership_data = '{}' OR user_memberships_v2.membership_data->>'remaining_credits' IS NULL);