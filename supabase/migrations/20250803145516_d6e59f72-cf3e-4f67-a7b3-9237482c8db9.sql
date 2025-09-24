-- Remove existing constraint and recreate with correct values
ALTER TABLE public.profiles DROP CONSTRAINT valid_membership_type;

-- Clean up existing data first
UPDATE public.profiles 
SET membership_type = 'Member' 
WHERE membership_type NOT IN ('Member', 'Wellpass', '10er Karte', 'Trainer') 
   OR membership_type IS NULL;

-- Add constraint with all valid types including Trainer
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_membership_type 
CHECK (membership_type IN ('Member', 'Wellpass', '10er Karte', 'Trainer'));