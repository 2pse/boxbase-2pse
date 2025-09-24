-- Test the advance_waitlist function manually for existing courses
-- Let's manually call it for all courses that have waitlisted users

DO $$
DECLARE
    course_record RECORD;
BEGIN
    FOR course_record IN 
        SELECT DISTINCT course_id 
        FROM course_registrations 
        WHERE status = 'waitlisted'
    LOOP
        RAISE NOTICE 'Testing advance_waitlist for course: %', course_record.course_id;
        PERFORM advance_waitlist(course_record.course_id);
    END LOOP;
END $$;