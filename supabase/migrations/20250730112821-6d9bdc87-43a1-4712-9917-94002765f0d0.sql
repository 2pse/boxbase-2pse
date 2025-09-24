-- Add status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Add last_login_at column to profiles table to track login times
ALTER TABLE public.profiles 
ADD COLUMN last_login_at timestamp with time zone DEFAULT now();

-- Update RLS policy to allow admins to delete profiles
CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to update last login time
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_login_at = now() 
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Create trigger to update last login on auth
CREATE TRIGGER on_auth_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW 
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.update_last_login();

-- Create function to automatically set inactive status for inactive members
CREATE OR REPLACE FUNCTION public.update_member_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET status = 'inactive'
  WHERE membership_type IN ('Wellpass', '10er Karte')
    AND last_login_at < now() - interval '30 days'
    AND status = 'active';
END;
$$;