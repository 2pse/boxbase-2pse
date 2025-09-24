-- Update existing user's authors field from auth metadata
UPDATE profiles 
SET authors = (auth.jwt() ->> 'user_metadata' ->> 'authors')::boolean
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE raw_user_meta_data ->> 'authors' = 'true'
);

-- Update the trigger to properly sync authors field
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer set search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    display_name, 
    access_code, 
    membership_type,
    authors
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'display_name', 
    new.raw_user_meta_data ->> 'access_code',
    new.raw_user_meta_data ->> 'membership_type',
    COALESCE((new.raw_user_meta_data ->> 'authors')::boolean, false)
  );
  RETURN new;
END;
$$;