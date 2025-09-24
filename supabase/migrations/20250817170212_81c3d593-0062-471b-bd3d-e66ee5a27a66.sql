-- Add welcome_dialog_shown field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN welcome_dialog_shown boolean NOT NULL DEFAULT false;

-- Update RLS policies to allow users to update their own welcome_dialog_shown field
-- (The existing "Users can update their own profile" policy should already cover this)