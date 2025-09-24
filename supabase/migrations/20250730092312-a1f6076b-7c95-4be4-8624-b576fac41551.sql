-- Update RLS policies to allow trainers to view course registrations
CREATE POLICY "Trainers can view course registrations" 
ON public.course_registrations 
FOR SELECT 
USING (has_role(auth.uid(), 'trainer'::app_role));

-- Update RLS policies to allow trainers to view courses
CREATE POLICY "Trainers can view courses" 
ON public.courses 
FOR SELECT 
USING (has_role(auth.uid(), 'trainer'::app_role));

-- Update RLS policies to allow trainers to view member profiles for courses
CREATE POLICY "Trainers can view member profiles for courses" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'trainer'::app_role));

-- Allow admins to delete course registrations (for removing participants)
CREATE POLICY "Admins can delete course registrations" 
ON public.course_registrations 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));