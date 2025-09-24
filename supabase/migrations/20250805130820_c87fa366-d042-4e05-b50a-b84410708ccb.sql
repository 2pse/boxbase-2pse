-- Add cancellation_deadline_minutes to course_templates table
ALTER TABLE public.course_templates 
ADD COLUMN cancellation_deadline_minutes integer NOT NULL DEFAULT 60;

-- Add cancellation_deadline_minutes to courses table  
ALTER TABLE public.courses
ADD COLUMN cancellation_deadline_minutes integer NOT NULL DEFAULT 60;

-- Update existing records to use the default value
UPDATE public.course_templates SET cancellation_deadline_minutes = 60 WHERE cancellation_deadline_minutes IS NULL;
UPDATE public.courses SET cancellation_deadline_minutes = 60 WHERE cancellation_deadline_minutes IS NULL;