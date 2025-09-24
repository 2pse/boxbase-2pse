-- Update the handle_new_user trigger function to extract all relevant fields from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    display_name, 
    first_name, 
    last_name, 
    access_code
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'access_code'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'member');
  
  RETURN new;
END;
$$;

-- Update existing Magnus Test record with missing data from auth metadata
UPDATE public.profiles 
SET 
  first_name = 'Magnus',
  last_name = 'Test',
  access_code = 'MAGNUS123'
WHERE user_id = '961ffc0f-710e-4fa6-bdb2-db835d44cb2e' 
  AND display_name = 'Magnus Test';