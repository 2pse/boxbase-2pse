-- Add app_icon_url field to gym_settings table
ALTER TABLE public.gym_settings 
ADD COLUMN app_icon_url text;