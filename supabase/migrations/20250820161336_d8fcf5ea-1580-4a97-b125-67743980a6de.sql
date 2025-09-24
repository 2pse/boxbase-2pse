-- Create gym_settings table for branding and configuration
CREATE TABLE public.gym_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_name TEXT NOT NULL DEFAULT 'BoxBase',
  logo_light_url TEXT,
  logo_dark_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#52a7b4',
  theme_mode TEXT NOT NULL DEFAULT 'both' CHECK (theme_mode IN ('light', 'dark', 'both')),
  whatsapp_number TEXT,
  contact_email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view gym settings"
ON public.gym_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage gym settings"
ON public.gym_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.gym_settings (gym_name, primary_color, theme_mode)
VALUES ('BoxBase', '#52a7b4', 'both');

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('gym-logos', 'gym-logos', true);

-- Create storage policies for gym logos
CREATE POLICY "Anyone can view gym logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'gym-logos');

CREATE POLICY "Admins can upload gym logos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'gym-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update gym logos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'gym-logos' AND has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_gym_settings_updated_at
BEFORE UPDATE ON public.gym_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create view for financial reporting
CREATE OR REPLACE VIEW public.monthly_revenue_view AS
SELECT 
  DATE_TRUNC('month', um.start_date) as month,
  mp.name as membership_plan_name,
  mp.booking_type,
  mp.price_monthly,
  COUNT(*) as member_count,
  SUM(mp.price_monthly) as total_revenue
FROM public.user_memberships um
JOIN public.membership_plans mp ON um.membership_plan_id = mp.id
WHERE um.status = 'active'
GROUP BY 
  DATE_TRUNC('month', um.start_date),
  mp.name,
  mp.booking_type,
  mp.price_monthly
ORDER BY month DESC;