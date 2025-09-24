-- Drop the existing check constraint for membership_type
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_membership_type;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_membership_type_check;

-- Add new check constraint with updated membership types
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_membership_type 
CHECK (membership_type IN ('Basic Member', 'Premium Member', 'Trainer', 'Administrator', 'Open Gym', 'Wellpass', '10er Karte'));

-- Now update existing Member entries to Premium Member
UPDATE public.profiles 
SET membership_type = 'Premium Member' 
WHERE membership_type = 'Member';