-- Remove remaining_credits from all limited memberships
-- Limited memberships should calculate availability dynamically, not store credits
UPDATE user_memberships_v2
SET membership_data = membership_data - 'remaining_credits'
WHERE membership_plan_id IN (
  SELECT id FROM membership_plans_v2 
  WHERE booking_rules->>'type' = 'limited'
);