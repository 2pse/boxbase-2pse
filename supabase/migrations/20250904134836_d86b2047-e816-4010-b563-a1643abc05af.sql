-- Create a secure database function to get member emails for admins
CREATE OR REPLACE FUNCTION public.get_member_emails_for_admin(user_ids uuid[])
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_check boolean;
BEGIN
  -- Check if current user is admin
  SELECT has_role(auth.uid(), 'admin'::app_role) INTO admin_check;
  
  IF NOT admin_check THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Return user emails from auth.users for the provided user_ids
  RETURN QUERY
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
END;
$$;