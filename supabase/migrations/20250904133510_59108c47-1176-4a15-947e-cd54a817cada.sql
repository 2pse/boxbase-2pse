-- Fix the update_member_status function to include proper WHERE clause
CREATE OR REPLACE FUNCTION public.update_member_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Simple heuristic: active if recently seen, else inactive
  -- Only update profiles that actually need status changes
  UPDATE public.profiles 
  SET 
    status = CASE 
      WHEN last_login_at IS NOT NULL AND last_login_at > now() - interval '90 days' THEN 'active'
      ELSE 'inactive'
    END,
    updated_at = now()
  WHERE 
    -- Only update rows where the status would actually change
    (status != 'active' AND last_login_at IS NOT NULL AND last_login_at > now() - interval '90 days')
    OR 
    (status != 'inactive' AND (last_login_at IS NULL OR last_login_at <= now() - interval '90 days'));
END;
$$;