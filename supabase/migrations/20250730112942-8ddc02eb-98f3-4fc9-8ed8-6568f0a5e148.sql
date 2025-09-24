-- Fix security issues by recreating functions with proper search_path
-- First drop trigger and function with CASCADE
DROP TRIGGER IF EXISTS on_auth_login ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.update_last_login() CASCADE;

-- Recreate function with proper search_path
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

-- Recreate trigger
CREATE TRIGGER on_auth_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW 
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.update_last_login();

-- Fix update_member_status function
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