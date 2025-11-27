-- Create email_templates table for reusable email templates
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admins can manage email templates" ON public.email_templates
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add webhook URLs to gym_settings
ALTER TABLE public.gym_settings 
ADD COLUMN IF NOT EXISTS webhook_email_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_news_url TEXT;

-- Add email_sent_at to news table to prevent duplicate sends
ALTER TABLE public.news
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- Create updated_at trigger for email_templates
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();