-- Create function to automatically process waitlists when someone cancels a course registration
CREATE OR REPLACE FUNCTION public.process_waitlists_on_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status changed from registered/waitlist to cancelled
  IF OLD.status IN ('registered', 'waitlist') AND NEW.status = 'cancelled' THEN
    -- Call the edge function to process waitlists
    -- We use pg_net to make HTTP request to the edge function
    PERFORM net.http_post(
      url := 'https://vdpeyaphtsbrhygupfbc.supabase.co/functions/v1/process-waitlists',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkcGV5YXBodHNicmh5Z3VwZmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MzA1NTQsImV4cCI6MjA2OTIwNjU1NH0.di1zDFbMIYpX-FNsSshaf4q-OMW8SpLqYM5SToltcCI"}'::jsonb,
      body := '{"trigger": "cancellation"}'::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that calls the function when course registrations are updated
DROP TRIGGER IF EXISTS trigger_process_waitlists_on_cancellation ON public.course_registrations;
CREATE TRIGGER trigger_process_waitlists_on_cancellation
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.process_waitlists_on_cancellation();