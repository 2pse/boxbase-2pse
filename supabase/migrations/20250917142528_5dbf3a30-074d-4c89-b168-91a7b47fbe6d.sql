-- Add policy to allow viewing registrations for active courses
CREATE POLICY "Anyone can view registrations for active courses" 
ON public.course_registrations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = course_registrations.course_id 
    AND courses.status = 'active'
  )
);