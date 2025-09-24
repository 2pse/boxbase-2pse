-- Make user_id nullable in profiles table for admin-created members
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;