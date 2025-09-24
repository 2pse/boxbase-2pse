-- Clean up existing data first, then add constraint
-- Check current membership types and update invalid ones
UPDATE public.profiles 
SET membership_type = 'Member' 
WHERE membership_type NOT IN ('Member', 'Wellpass', '10er Karte', 'Trainer') 
   OR membership_type IS NULL;

-- Now add the constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_membership_type 
CHECK (membership_type IN ('Member', 'Wellpass', '10er Karte', 'Trainer'));