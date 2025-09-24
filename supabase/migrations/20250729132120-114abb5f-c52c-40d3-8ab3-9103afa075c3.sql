-- Add foreign key constraint between course_registrations and profiles
ALTER TABLE public.course_registrations 
ADD CONSTRAINT course_registrations_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

-- Also add foreign key constraint to courses table
ALTER TABLE public.course_registrations 
ADD CONSTRAINT course_registrations_course_id_fkey 
FOREIGN KEY (course_id) REFERENCES public.courses(id);