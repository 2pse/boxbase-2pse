-- Debug create-member function by checking if user_roles table structure is correct
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public';

-- Check if app_role enum exists and has all values
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role');

-- Ensure profiles trigger is working for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, membership_type)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'display_name', 
    new.raw_user_meta_data ->> 'membership_type'
  );
  RETURN new;
END;
$$;