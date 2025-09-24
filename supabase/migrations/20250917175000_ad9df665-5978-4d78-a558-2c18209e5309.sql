-- Add webhook URLs to gym_settings table
ALTER TABLE public.gym_settings 
ADD COLUMN webhook_member_url text,
ADD COLUMN webhook_waitlist_url text;