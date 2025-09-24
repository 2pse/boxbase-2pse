-- Fix the status constraint issue and promote Magnus
-- First, check what statuses are allowed

-- Drop the check constraint temporarily to fix the data
ALTER TABLE course_registrations DROP CONSTRAINT IF EXISTS course_registrations_status_check;

-- Update the status from 'waitlist' to 'waitlisted' to be consistent
UPDATE course_registrations 
SET status = 'waitlisted' 
WHERE status = 'waitlist';

-- Re-add the constraint with both values allowed for now
ALTER TABLE course_registrations ADD CONSTRAINT course_registrations_status_check 
CHECK (status IN ('registered', 'waitlisted', 'cancelled', 'waitlist'));

-- Now manually run the advance_waitlist function for the specific course
DO $$
DECLARE
    course_uuid UUID;
BEGIN
    -- Get the course ID for the specific course
    SELECT id INTO course_uuid
    FROM courses 
    WHERE course_date = '2025-08-06' 
    AND start_time = '17:00:00'
    AND title = 'Functional Fitness';
    
    IF course_uuid IS NOT NULL THEN
        RAISE NOTICE 'Running advance_waitlist for course: %', course_uuid;
        PERFORM advance_waitlist(course_uuid);
    END IF;
END $$;