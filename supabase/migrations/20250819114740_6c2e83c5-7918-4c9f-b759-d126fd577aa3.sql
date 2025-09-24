-- Add WOD content field to courses table
ALTER TABLE public.courses 
ADD COLUMN wod_content text;