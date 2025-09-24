-- Initialize credits for existing Limited memberships with empty membership_data
UPDATE user_memberships_v2 
SET membership_data = jsonb_build_object(
  'remaining_credits', 
  COALESCE((mp2.booking_rules->'limit'->>'count')::integer, 8)
),
updated_at = now()
FROM membership_plans_v2 mp2
WHERE user_memberships_v2.membership_plan_id = mp2.id
  AND mp2.booking_rules->>'type' = 'limited'
  AND (user_memberships_v2.membership_data = '{}' 
       OR user_memberships_v2.membership_data->>'remaining_credits' IS NULL)
  AND user_memberships_v2.status = 'active';