-- First, let's check what constraints exist on the profiles table
SELECT constraint_name, constraint_type, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public' 
AND constraint_name LIKE '%membership%';

-- Drop the existing check constraint for membership_type
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_membership_type;

-- Add new check constraint with updated membership types
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_membership_type 
CHECK (membership_type IN ('Basic Member', 'Premium Member', 'Trainer', 'Administrator', 'Open Gym', 'Wellpass', '10er Karte'));

-- Now update existing Member entries to Premium Member
UPDATE public.profiles 
SET membership_type = 'Premium Member' 
WHERE membership_type = 'Member';