-- Create revenue_history table to preserve historical financial data
CREATE TABLE public.revenue_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid, -- nullable, so we keep historical data even after user deletion
  membership_plan_id uuid, -- nullable, plan might be deleted too
  membership_plan_name text NOT NULL,
  amount numeric NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  booking_type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_reason text -- 'user_deleted', 'membership_cancelled', etc.
);

-- Enable RLS
ALTER TABLE public.revenue_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for revenue_history
CREATE POLICY "Admins can manage revenue history" 
ON public.revenue_history 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create function to archive revenue when membership is deleted
CREATE OR REPLACE FUNCTION public.archive_revenue_on_membership_delete()
RETURNS TRIGGER AS $$
DECLARE
  plan_name text;
  plan_booking_type text;
  monthly_price numeric;
BEGIN
  -- Get plan details
  SELECT 
    mp.name,
    mp.booking_rules->>'type',
    mp.price_monthly
  INTO plan_name, plan_booking_type, monthly_price
  FROM public.membership_plans_v2 mp
  WHERE mp.id = OLD.membership_plan_id;

  -- Create revenue history entry for each month the membership was active
  -- This ensures we preserve the financial impact
  INSERT INTO public.revenue_history (
    user_id,
    membership_plan_id,
    membership_plan_name,
    amount,
    period_start,
    period_end,
    booking_type,
    deleted_reason
  )
  SELECT
    OLD.user_id,
    OLD.membership_plan_id,
    COALESCE(plan_name, 'Unknown Plan'),
    COALESCE(monthly_price, 0),
    OLD.start_date,
    COALESCE(OLD.end_date, CURRENT_DATE),
    COALESCE(plan_booking_type, 'unknown'),
    'membership_deleted';

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for membership deletion
CREATE TRIGGER archive_revenue_before_membership_delete
  BEFORE DELETE ON public.user_memberships_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_revenue_on_membership_delete();

-- Update the existing profile cleanup function to also archive revenue
DROP TRIGGER IF EXISTS cleanup_memberships_after_profile_delete ON public.profiles;
DROP FUNCTION IF EXISTS public.cleanup_user_memberships_on_profile_delete();

CREATE OR REPLACE FUNCTION public.cleanup_user_memberships_on_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Revenue will be automatically archived by the membership delete trigger
  -- when we delete the memberships below
  
  -- Delete all memberships for this user (triggers revenue archiving)
  DELETE FROM public.user_memberships_v2 
  WHERE user_id = OLD.user_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the profile cleanup trigger
CREATE TRIGGER cleanup_memberships_after_profile_delete
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_memberships_on_profile_delete();