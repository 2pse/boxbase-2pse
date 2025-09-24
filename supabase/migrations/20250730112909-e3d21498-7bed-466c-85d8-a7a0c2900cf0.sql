-- Fix security issue: Set search_path for update_last_login function
DROP FUNCTION IF EXISTS public.update_last_login();

CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_login_at = now() 
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Fix security issue: Set search_path for update_member_status function  
DROP FUNCTION IF EXISTS public.update_member_status();

CREATE OR REPLACE FUNCTION public.update_member_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles 
  SET status = 'inactive'
  WHERE membership_type IN ('Wellpass', '10er Karte')
    AND last_login_at < now() - interval '30 days'
    AND status = 'active';
END;
$$;