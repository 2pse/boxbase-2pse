-- Fix auto_renewal for existing RX'D memberships
-- Update all RX'D plan memberships to have correct auto_renewal value

UPDATE public.user_memberships_v2
SET auto_renewal = true,
    updated_at = now()
WHERE membership_plan_id IN (
  SELECT id 
  FROM public.membership_plans_v2 
  WHERE name ILIKE '%RX''D%' 
  AND auto_renewal = true
)
AND auto_renewal = false;

-- Log the operation
DO $$
DECLARE
  updated_count integer;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % RX''D memberships with correct auto_renewal setting', updated_count;
END $$;