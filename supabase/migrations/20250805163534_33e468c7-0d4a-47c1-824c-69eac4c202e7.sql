-- Update the app_role enum to include new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'basic_member';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'premium_member';

-- Create table for 10er Karte credit management
CREATE TABLE public.membership_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  credits_total INTEGER NOT NULL DEFAULT 0,
  last_recharged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for Basic Member weekly course limits
CREATE TABLE public.weekly_course_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  registrations_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

-- Enable RLS on new tables
ALTER TABLE public.membership_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_course_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for membership_credits
CREATE POLICY "Users can view their own credits" 
ON public.membership_credits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all credits" 
ON public.membership_credits 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for weekly_course_limits
CREATE POLICY "Users can view their own limits" 
ON public.weekly_course_limits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage course limits" 
ON public.weekly_course_limits 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add triggers for updated_at
CREATE TRIGGER update_membership_credits_updated_at
BEFORE UPDATE ON public.membership_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekly_course_limits_updated_at
BEFORE UPDATE ON public.weekly_course_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();