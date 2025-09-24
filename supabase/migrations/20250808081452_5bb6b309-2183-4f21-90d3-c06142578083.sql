-- Create trigger to process waitlists when a registration is cancelled
-- and add helpful indexes for performance

-- 1) Safety: drop existing trigger if present
DROP TRIGGER IF EXISTS trg_process_waitlists_on_cancellation ON public.course_registrations;

-- 2) Create the trigger to invoke our function after updates
CREATE TRIGGER trg_process_waitlists_on_cancellation
AFTER UPDATE ON public.course_registrations
FOR EACH ROW
EXECUTE FUNCTION public.process_waitlists_on_cancellation();

-- 3) Performance indexes
-- Help counting current registered and promoting oldest waitlisted
CREATE INDEX IF NOT EXISTS idx_course_registrations_course_status_registered_at
  ON public.course_registrations (course_id, status, registered_at);

-- Help edge function query pending events quickly
CREATE INDEX IF NOT EXISTS idx_waitlist_promotion_events_notified_at
  ON public.waitlist_promotion_events (notified_at);
