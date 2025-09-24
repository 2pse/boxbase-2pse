-- Enable real-time for course_registrations table
ALTER TABLE public.course_registrations REPLICA IDENTITY FULL;

-- Enable real-time for training_sessions table
ALTER TABLE public.training_sessions REPLICA IDENTITY FULL;

-- Enable real-time for courses table
ALTER TABLE public.courses REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication for real-time functionality
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.training_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.courses;