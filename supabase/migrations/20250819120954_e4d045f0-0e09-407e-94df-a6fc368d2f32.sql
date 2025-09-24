-- Create enums for membership plan system
CREATE TYPE public.booking_type AS ENUM (
  'unlimited',
  'weekly_limit', 
  'monthly_limit',
  'open_gym_only',
  'credits'
);

CREATE TYPE public.period_type AS ENUM (
  'week',
  'month'
);

CREATE TYPE public.membership_status AS ENUM (
  'active',
  'expired', 
  'cancelled',
  'paused'
);

-- Create membership_plans table
CREATE TABLE public.membership_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  booking_type booking_type NOT NULL,
  booking_limit integer,
  period_type period_type,
  includes_open_gym boolean NOT NULL DEFAULT false,
  auto_renewal boolean NOT NULL DEFAULT false,
  default_duration_months integer NOT NULL DEFAULT 1,
  price_monthly numeric(10,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_memberships table
CREATE TABLE public.user_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  membership_plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
  start_date date NOT NULL,
  end_date date,
  auto_renewal boolean NOT NULL DEFAULT false,
  status membership_status NOT NULL DEFAULT 'active',
  remaining_credits integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for membership_plans
CREATE POLICY "Admins can manage membership plans"
ON public.membership_plans
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active membership plans"
ON public.membership_plans
FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS Policies for user_memberships
CREATE POLICY "Admins can manage all user memberships"
ON public.user_memberships
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own memberships"
ON public.user_memberships
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_membership_plans_updated_at
  BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_memberships_updated_at
  BEFORE UPDATE ON public.user_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default membership plans to replace current system
INSERT INTO public.membership_plans (name, description, booking_type, booking_limit, period_type, includes_open_gym, price_monthly) VALUES
('Basic Member', 'Bis zu 2 Kurse pro Woche', 'weekly_limit', 2, 'week', false, 29.90),
('Premium Member', 'Unbegrenzte Kurse', 'unlimited', null, null, true, 49.90),
('10er Karte', '10 Buchungen als Credits', 'credits', 10, null, false, 150.00),
('Open Gym', 'Nur Open Gym Zugang', 'open_gym_only', null, null, true, 19.90),
('Wellpass', 'Wellpass Integration', 'unlimited', null, null, true, 0.00);