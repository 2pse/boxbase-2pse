-- First, let's update the Administrator user correctly
UPDATE public.profiles 
SET membership_type = 'Administrator' 
WHERE display_name = 'Administrator';

-- Update regular Members to Premium Members  
UPDATE public.profiles 
SET membership_type = 'Premium Member' 
WHERE membership_type = 'Member' AND display_name != 'Administrator';

-- Now add the check constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_membership_type 
CHECK (membership_type IN ('Basic Member', 'Premium Member', 'Trainer', 'Administrator', 'Open Gym', 'Wellpass', '10er Karte'));