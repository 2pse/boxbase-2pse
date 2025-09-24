-- Update inactivity threshold to 21 days for Wellpass and 10er Karte
CREATE OR REPLACE FUNCTION public.update_member_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.profiles 
  SET status = 'inactive'
  WHERE membership_type IN ('Wellpass', '10er Karte')
    AND last_login_at < now() - interval '21 days'
    AND status = 'active';
END;
$function$;