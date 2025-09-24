-- Add webhook reactivation URL to gym settings
ALTER TABLE public.gym_settings 
ADD COLUMN webhook_reactivation_url text;

-- Add reactivation webhook tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN reactivation_webhook_sent_at timestamp with time zone;

-- Update the member status function to use 21 days instead of 90
CREATE OR REPLACE FUNCTION public.update_member_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Simple heuristic: active if recently seen (21 days), else inactive
  -- Only update profiles that actually need status changes
  UPDATE public.profiles 
  SET 
    status = CASE 
      WHEN last_login_at IS NOT NULL AND last_login_at > now() - interval '21 days' THEN 'active'
      ELSE 'inactive'
    END,
    updated_at = now()
  WHERE 
    -- Only update rows where the status would actually change
    (status != 'active' AND last_login_at IS NOT NULL AND last_login_at > now() - interval '21 days')
    OR 
    (status != 'inactive' AND (last_login_at IS NULL OR last_login_at <= now() - interval '21 days'));
END;
$function$;

-- Create function to trigger reactivation webhook
CREATE OR REPLACE FUNCTION public.trigger_reactivation_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  webhook_url text;
BEGIN
  -- Only trigger if status changed from active to inactive
  IF OLD.status = 'active' AND NEW.status = 'inactive' 
     AND (NEW.reactivation_webhook_sent_at IS NULL OR NEW.reactivation_webhook_sent_at < now() - interval '21 days') THEN
    
    -- Get webhook URL
    SELECT webhook_reactivation_url INTO webhook_url FROM public.gym_settings LIMIT 1;
    
    -- Mark webhook as sent
    NEW.reactivation_webhook_sent_at = now();
    
    -- Insert webhook event for processing
    INSERT INTO public.reactivation_webhook_events (
      user_id,
      profile_data,
      webhook_url,
      created_at
    ) VALUES (
      NEW.user_id,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'display_name', NEW.display_name,
        'nickname', NEW.nickname,
        'access_code', NEW.access_code,
        'last_login_at', NEW.last_login_at,
        'status', NEW.status
      ),
      webhook_url,
      now()
    );
  END IF;
  
  -- Reset webhook tracking when user becomes active again
  IF OLD.status = 'inactive' AND NEW.status = 'active' THEN
    NEW.reactivation_webhook_sent_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create table for reactivation webhook events
CREATE TABLE public.reactivation_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  profile_data jsonb NOT NULL,
  webhook_url text,
  processed_at timestamp with time zone,
  success boolean,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on webhook events table
ALTER TABLE public.reactivation_webhook_events ENABLE ROW LEVEL SECURITY;

-- Create policy for webhook events
CREATE POLICY "Admins can manage reactivation webhook events" 
ON public.reactivation_webhook_events 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for profile status changes
CREATE TRIGGER profile_status_change_webhook
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_reactivation_webhook();

-- Set up cron job to run member status update daily at 6 AM
SELECT cron.schedule(
  'update-member-status-daily',
  '0 6 * * *', -- Every day at 6 AM
  $$
  SELECT public.update_member_status();
  $$
);

-- Set up cron job to process reactivation webhooks every 5 minutes
SELECT cron.schedule(
  'process-reactivation-webhooks',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://tuktvbawwyffuqeorjix.supabase.co/functions/v1/process-reactivation-webhooks',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1a3R2YmF3d3lmZnVxZW9yaml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDk2MjMsImV4cCI6MjA3NDIyNTYyM30.7Y0mcnXhq6Y8jqok6AR9qbyeBIQrMcIhmiA9q2p0lkc"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);