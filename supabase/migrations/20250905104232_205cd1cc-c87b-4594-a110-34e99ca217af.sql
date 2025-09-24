-- Fix Magnus Test's membership - Update him to the "10er Karte" plan
-- Deactivate his current V2 Basic membership
UPDATE user_memberships_v2 
SET status = 'expired', updated_at = now()
WHERE user_id = '090a50eb-141c-428f-950f-701dd2b94782' AND status = 'active';

-- Deactivate his V1 membership  
UPDATE user_memberships
SET status = 'expired', updated_at = now()
WHERE user_id = '090a50eb-141c-428f-950f-701dd2b94782' AND status = 'active';

-- Create new V2 membership with "10er Karte" plan
INSERT INTO user_memberships_v2 (
  user_id,
  membership_plan_id, 
  start_date,
  end_date,
  auto_renewal,
  status,
  membership_data
) VALUES (
  '090a50eb-141c-428f-950f-701dd2b94782',
  '76679d87-309a-4a53-9703-168826c15488', -- 10er Karte plan ID
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '12 months', -- 12 months duration 
  false,
  'active',
  '{"remaining_credits": 10}'::jsonb -- Start with 10 credits
);