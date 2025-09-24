-- Fix existing membership plans with missing period_type
-- Update all monthly_limit plans that have null period_type
UPDATE public.membership_plans 
SET period_type = 'monthly', updated_at = now()
WHERE booking_type = 'monthly_limit' AND period_type IS NULL;

-- Update all weekly_limit plans that have null period_type (if any exist)
UPDATE public.membership_plans 
SET period_type = 'weekly', updated_at = now()
WHERE booking_type = 'weekly_limit' AND period_type IS NULL;

-- Log the changes made
SELECT 
  id, 
  name, 
  booking_type, 
  booking_limit, 
  period_type,
  updated_at
FROM public.membership_plans 
WHERE booking_type IN ('monthly_limit', 'weekly_limit', 'credits')
ORDER BY updated_at DESC;