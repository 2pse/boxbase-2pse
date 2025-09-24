-- Create Trainer membership plan
INSERT INTO public.membership_plans (
  name,
  description,
  booking_type,
  booking_limit,
  period_type,
  price_monthly,
  default_duration_months,
  includes_open_gym,
  auto_renewal,
  is_active
) VALUES (
  'Trainer',
  'Trainer mit vollen Berechtigungen und Zugang zu allen Funktionen',
  'unlimited',
  NULL,
  NULL,
  0.00,
  12,
  true,
  false,
  true
);