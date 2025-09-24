-- Add color column to course_templates table
ALTER TABLE public.course_templates 
ADD COLUMN color text DEFAULT '#3B82F6';

-- Add color column to courses table  
ALTER TABLE public.courses 
ADD COLUMN color text DEFAULT '#3B82F6';

-- Create index on course color for better performance
CREATE INDEX idx_courses_color ON public.courses(color);
CREATE INDEX idx_course_templates_color ON public.course_templates(color);