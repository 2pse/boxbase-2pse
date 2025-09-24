-- First, let's see what constraints currently exist
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.profiles'::regclass 
AND contype = 'c';

-- Drop any existing check constraints on membership_type
DO $$ 
DECLARE 
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass 
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%membership_type%'
    LOOP
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(constraint_record.conname);
    END LOOP;
END $$;

-- Now update the data safely
UPDATE public.profiles 
SET membership_type = 'Administrator' 
WHERE display_name = 'Administrator';

UPDATE public.profiles 
SET membership_type = 'Premium Member' 
WHERE membership_type = 'Member';

-- Add the new constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_membership_type 
CHECK (membership_type IN ('Basic Member', 'Premium Member', 'Trainer', 'Administrator', 'Open Gym', 'Wellpass', '10er Karte'));