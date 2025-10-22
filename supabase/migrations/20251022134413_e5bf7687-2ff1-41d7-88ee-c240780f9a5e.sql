-- Drop the ineffective trigger that was created
DROP TRIGGER IF EXISTS course_registration_auto_complete ON public.course_registrations;
DROP FUNCTION IF EXISTS public.trigger_auto_complete_on_registration();

-- Create new function to auto-complete courses that finished today
CREATE OR REPLACE FUNCTION public.auto_complete_finished_courses_today()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  finished_course RECORD;
BEGIN
  -- Find all courses that ended today
  FOR finished_course IN
    SELECT DISTINCT 
      c.id, 
      c.course_date, 
      c.end_time,
      (c.course_date::timestamp + c.end_time)::timestamptz as finished_at
    FROM courses c
    WHERE c.course_date = CURRENT_DATE
      AND (c.course_date::timestamp + c.end_time)::timestamptz <= NOW()
      AND c.is_cancelled = false
      AND c.status = 'active'
  LOOP
    -- Create training_sessions for all registered users
    INSERT INTO training_sessions (
      user_id,
      session_date,
      completed_at,
      status,
      session_type
    )
    SELECT 
      cr.user_id,
      finished_course.course_date,
      finished_course.finished_at,
      'completed',
      'course'
    FROM course_registrations cr
    WHERE cr.course_id = finished_course.id
      AND cr.status = 'registered'
      AND NOT EXISTS (
        SELECT 1 FROM training_sessions ts
        WHERE ts.user_id = cr.user_id
          AND ts.session_date = finished_course.course_date
      )
    ON CONFLICT (user_id, session_date) DO NOTHING;
  END LOOP;
END;
$function$;

-- Schedule hourly cron job to run at :01 every hour
SELECT cron.schedule(
  'auto-complete-finished-courses-hourly',
  '1 * * * *',
  $$SELECT auto_complete_finished_courses_today()$$
);