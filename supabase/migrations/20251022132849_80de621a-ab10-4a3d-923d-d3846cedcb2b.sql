-- Fix the function to have immutable search_path
CREATE OR REPLACE FUNCTION auto_complete_past_courses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  past_course RECORD;
  registration RECORD;
BEGIN
  -- Find all courses that ended in the past and are not cancelled
  FOR past_course IN
    SELECT DISTINCT c.id, c.course_date, c.start_time
    FROM courses c
    WHERE c.course_date < CURRENT_DATE
      AND c.is_cancelled = false
      AND c.status = 'active'
  LOOP
    -- For each past course, check all registrations
    FOR registration IN
      SELECT cr.user_id, cr.course_id
      FROM course_registrations cr
      WHERE cr.course_id = past_course.id
        AND cr.status = 'registered'
        AND NOT EXISTS (
          SELECT 1 FROM training_sessions ts
          WHERE ts.user_id = cr.user_id
            AND ts.session_date = past_course.course_date
        )
    LOOP
      -- Insert training session for this user
      INSERT INTO training_sessions (
        user_id,
        session_date,
        completed_at,
        status,
        session_type
      ) VALUES (
        registration.user_id,
        past_course.course_date,
        (past_course.course_date + past_course.start_time)::timestamptz,
        'completed',
        'course'
      );
    END LOOP;
  END LOOP;
END;
$$;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function to run daily at 2 AM
SELECT cron.schedule(
  'auto-complete-past-courses',
  '0 2 * * *',
  $$SELECT auto_complete_past_courses()$$
);