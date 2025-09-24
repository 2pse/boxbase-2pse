-- Clean up cancelled course registrations for Björn (user with display_name 'Björn')
DELETE FROM public.course_registrations 
WHERE status = 'cancelled' 
AND user_id IN (
  SELECT user_id 
  FROM public.profiles 
  WHERE display_name = 'Björn'
);