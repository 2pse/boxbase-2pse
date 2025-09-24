-- Add function to generate courses from templates  
CREATE OR REPLACE FUNCTION generate_courses_from_template(
  template_id_param UUID,
  start_date_param DATE,
  end_date_param DATE
) RETURNS TABLE(
  course_id UUID,
  course_date DATE,
  start_time TIME,
  end_time TIME
) AS $$
DECLARE
  template_record RECORD;
  iter_date DATE;
  start_time_calc TIME;
  end_time_calc TIME;
  new_course_id UUID;
BEGIN
  -- Get template details
  SELECT * INTO template_record
  FROM course_templates
  WHERE id = template_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  
  -- Generate courses for each day in the date range
  iter_date := start_date_param;
  WHILE iter_date <= end_date_param LOOP
    -- For now, create courses at 18:00 (can be customized later)
    start_time_calc := '18:00:00'::TIME;
    end_time_calc := start_time_calc + (template_record.duration_minutes || ' minutes')::INTERVAL;
    
    -- Insert the course
    INSERT INTO courses (
      template_id,
      title,
      trainer,
      strength_exercise,
      course_date,
      start_time,
      end_time,
      max_participants,
      registration_deadline_minutes,
      duration_minutes
    ) VALUES (
      template_id_param,
      template_record.title,
      template_record.trainer,
      template_record.strength_exercise,
      iter_date,
      start_time_calc,
      end_time_calc,
      template_record.max_participants,
      template_record.registration_deadline_minutes,
      template_record.duration_minutes
    ) RETURNING id INTO new_course_id;
    
    -- Return the generated course info
    course_id := new_course_id;
    course_date := iter_date;
    start_time := start_time_calc;
    end_time := end_time_calc;
    RETURN NEXT;
    
    iter_date := iter_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;