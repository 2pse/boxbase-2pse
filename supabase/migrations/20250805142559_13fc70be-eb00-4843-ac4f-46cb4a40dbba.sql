-- Create trigger for automatic waitlist advancement
CREATE OR REPLACE TRIGGER course_registration_change_trigger
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_course_registration_change();