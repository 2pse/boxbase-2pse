-- Phase 1: Create new membership_plans_v2 table with simplified structure
CREATE TABLE public.membership_plans_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Basic properties
  price_monthly NUMERIC,
  duration_months INTEGER NOT NULL DEFAULT 1,
  auto_renewal BOOLEAN DEFAULT false,
  includes_open_gym BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Unified booking rules in JSON format
  booking_rules JSONB DEFAULT '{}' NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.membership_plans_v2 ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage membership plans v2" 
ON public.membership_plans_v2 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active membership plans v2" 
ON public.membership_plans_v2 
FOR SELECT 
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_membership_plans_v2_updated_at
BEFORE UPDATE ON public.membership_plans_v2
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data to new structure
INSERT INTO public.membership_plans_v2 (
  name, 
  description, 
  price_monthly, 
  duration_months, 
  auto_renewal, 
  includes_open_gym, 
  is_active,
  booking_rules,
  created_at,
  updated_at
)
SELECT 
  name,
  description,
  price_monthly,
  default_duration_months,
  auto_renewal,
  includes_open_gym,
  is_active,
  CASE 
    WHEN booking_type = 'unlimited' THEN 
      '{"type": "unlimited"}'::jsonb
    WHEN booking_type = 'credits' THEN 
      jsonb_build_object(
        'type', 'credits',
        'credits', jsonb_build_object(
          'initial_amount', COALESCE(booking_limit, 10),
          'refill_schedule', 'never'
        )
      )
    WHEN booking_type = 'monthly_limit' THEN 
      jsonb_build_object(
        'type', 'limited',
        'limit', jsonb_build_object(
          'count', COALESCE(booking_limit, 8),
          'period', 'month'
        )
      )
    WHEN booking_type = 'weekly_limit' THEN 
      jsonb_build_object(
        'type', 'limited',
        'limit', jsonb_build_object(
          'count', COALESCE(booking_limit, 2),
          'period', 'week'
        )
      )
    WHEN booking_type = 'open_gym_only' THEN 
      '{"type": "open_gym_only"}'::jsonb
    ELSE 
      '{"type": "unlimited"}'::jsonb
  END,
  created_at,
  updated_at
FROM public.membership_plans;

-- Create new user_memberships_v2 table
CREATE TABLE public.user_memberships_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  membership_plan_id UUID NOT NULL REFERENCES public.membership_plans_v2(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  auto_renewal BOOLEAN NOT NULL DEFAULT false,
  status membership_status NOT NULL DEFAULT 'active',
  
  -- Dynamic data based on booking rules
  membership_data JSONB DEFAULT '{}' NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_memberships_v2 ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all user memberships v2" 
ON public.user_memberships_v2 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own memberships v2" 
ON public.user_memberships_v2 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_memberships_v2_updated_at
BEFORE UPDATE ON public.user_memberships_v2
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing user memberships
INSERT INTO public.user_memberships_v2 (
  user_id,
  membership_plan_id,
  start_date,
  end_date,
  auto_renewal,
  status,
  membership_data,
  created_at,
  updated_at
)
SELECT 
  um.user_id,
  mp2.id, -- Reference to new membership_plans_v2 table
  um.start_date,
  um.end_date,
  um.auto_renewal,
  um.status,
  CASE 
    WHEN mp.booking_type = 'credits' THEN 
      jsonb_build_object(
        'remaining_credits', COALESCE(um.remaining_credits, mp.booking_limit, 10)
      )
    WHEN mp.booking_type IN ('monthly_limit', 'weekly_limit') THEN 
      jsonb_build_object(
        'used_this_period', 0,
        'period_start', um.start_date
      )
    ELSE 
      '{}'::jsonb
  END,
  um.created_at,
  um.updated_at
FROM public.user_memberships um
JOIN public.membership_plans mp ON um.membership_plan_id = mp.id
JOIN public.membership_plans_v2 mp2 ON mp.name = mp2.name; -- Match by name for migration