-- Clear all Stripe IDs so plans can be re-linked with correct recurring prices
UPDATE membership_plans_v2
SET 
  stripe_product_id = NULL,
  stripe_price_id = NULL,
  updated_at = now()
WHERE stripe_product_id IS NOT NULL;