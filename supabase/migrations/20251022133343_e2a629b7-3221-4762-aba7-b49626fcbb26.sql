-- Improve existing auto_complete_past_courses function with ON CONFLICT handling
CREATE OR REPLACE FUNCTION public.auto_complete_past_courses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      -- Insert training session for this user with ON CONFLICT handling
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
      )
      ON CONFLICT (user_id, session_date) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$function$;

-- Create trigger function for immediate auto-completion on registration
CREATE OR REPLACE FUNCTION public.trigger_auto_complete_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  course_info RECORD;
BEGIN
  -- Check if registration is for a past course
  SELECT c.course_date, c.start_time, c.is_cancelled, c.status
  INTO course_info
  FROM courses c
  WHERE c.id = NEW.course_id;

  -- If course is in the past and registration is active
  IF course_info.course_date < CURRENT_DATE
     AND course_info.is_cancelled = false
     AND course_info.status = 'active'
     AND NEW.status = 'registered' THEN
    
    -- Create training_session immediately
    INSERT INTO training_sessions (
      user_id,
      session_date,
      completed_at,
      status,
      session_type
    ) VALUES (
      NEW.user_id,
      course_info.course_date,
      (course_info.course_date + course_info.start_time)::timestamptz,
      'completed',
      'course'
    )
    ON CONFLICT (user_id, session_date) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on course_registrations
DROP TRIGGER IF EXISTS course_registration_auto_complete ON public.course_registrations;

CREATE TRIGGER course_registration_auto_complete
  AFTER INSERT OR UPDATE ON public.course_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_complete_on_registration();