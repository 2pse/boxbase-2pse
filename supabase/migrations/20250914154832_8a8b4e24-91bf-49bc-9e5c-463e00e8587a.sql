-- Update profiles with last login information from auth.users
UPDATE public.profiles 
SET 
  last_login_at = auth_users.last_sign_in_at,
  status = CASE 
    WHEN auth_users.last_sign_in_at IS NOT NULL AND auth_users.last_sign_in_at > now() - interval '90 days' THEN 'active'
    ELSE 'inactive'
  END,
  updated_at = now()
FROM auth.users auth_users
WHERE profiles.user_id = auth_users.id;

-- Create function to automatically update profiles when users login
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    last_login_at = NEW.last_sign_in_at,
    status = CASE 
      WHEN NEW.last_sign_in_at IS NOT NULL AND NEW.last_sign_in_at > now() - interval '90 days' THEN 'active'
      ELSE 'inactive'
    END,
    updated_at = now()
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update profiles on login
-- Note: This is conceptual - we'll handle this in the client side instead
-- since we cannot directly create triggers on auth.users

-- Alternative: Create a function that can be called to sync login data
CREATE OR REPLACE FUNCTION public.sync_user_login_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET 
    last_login_at = auth_users.last_sign_in_at,
    status = CASE 
      WHEN auth_users.last_sign_in_at IS NOT NULL AND auth_users.last_sign_in_at > now() - interval '90 days' THEN 'active'
      ELSE 'inactive'
    END,
    updated_at = now()
  FROM auth.users auth_users
  WHERE profiles.user_id = auth_users.id;
END;
$$;