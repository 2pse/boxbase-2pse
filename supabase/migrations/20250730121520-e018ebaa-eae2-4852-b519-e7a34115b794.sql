-- Add nickname field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN nickname TEXT;