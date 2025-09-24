-- Update default color for course_templates to light gray
ALTER TABLE public.course_templates 
ALTER COLUMN color SET DEFAULT '#f3f4f6';

-- Update default color for courses to light gray
ALTER TABLE public.courses 
ALTER COLUMN color SET DEFAULT '#f3f4f6';

-- Update existing NULL values to the new default
UPDATE public.course_templates 
SET color = '#f3f4f6' 
WHERE color IS NULL OR color = '#3B82F6';

UPDATE public.courses 
SET color = '#f3f4f6' 
WHERE color IS NULL OR color = '#3B82F6';