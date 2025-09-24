-- Fix the status inconsistency and promote Magnus from waitlist
-- First, let's check the status values and fix them

-- Update the status from 'waitlist' to 'waitlisted' to be consistent
UPDATE course_registrations 
SET status = 'waitlisted' 
WHERE status = 'waitlist';

-- Now manually run the advance_waitlist function for this specific course
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