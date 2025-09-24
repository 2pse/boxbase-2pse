-- Add membership_type column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN membership_type text DEFAULT 'Member';

-- Update existing profiles to have a default membership type
UPDATE public.profiles 
SET membership_type = 'Member' 
WHERE membership_type IS NULL;

-- Add constraint to ensure only valid membership types
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_membership_type 
CHECK (membership_type IN ('Member', 'Open Gym', 'Wellpass', '10er Karte'));