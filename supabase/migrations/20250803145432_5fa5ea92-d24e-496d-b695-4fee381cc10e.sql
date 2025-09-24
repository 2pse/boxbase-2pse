-- Check and fix membership_type constraint
-- First, let's see what constraint exists and update it to include 'Trainer'

-- Remove existing constraint if it exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_membership_type;

-- Add new constraint that includes 'Trainer'
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_membership_type 
CHECK (membership_type IN ('Member', 'Wellpass', '10er Karte', 'Trainer'));