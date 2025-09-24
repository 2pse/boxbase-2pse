-- Update all existing membership types to match new schema
UPDATE public.profiles 
SET membership_type = 'Premium Member' 
WHERE membership_type = 'Member';

-- Update Trainer to match new naming
UPDATE public.profiles 
SET membership_type = 'Trainer' 
WHERE membership_type = 'Trainer';

-- Now add the check constraint with all possible values
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_membership_type 
CHECK (membership_type IN ('Basic Member', 'Premium Member', 'Trainer', 'Administrator', 'Open Gym', 'Wellpass', '10er Karte'));