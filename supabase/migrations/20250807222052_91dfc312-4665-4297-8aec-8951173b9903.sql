-- Create table and trigger to enqueue waitlist promotion events when a user is promoted from waitlist to registered
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Events table consumed by edge function 'dispatch-waitlist-promotion-events'
CREATE TABLE IF NOT EXISTS public.waitlist_promotion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL,
  course_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ NULL,
  payload JSONB NULL
);

-- Avoid duplicate pending events for the same registration
CREATE UNIQUE INDEX IF NOT EXISTS ux_waitlist_events_registration_pending
  ON public.waitlist_promotion_events (registration_id)
  WHERE notified_at IS NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_events_created_at
  ON public.waitlist_promotion_events (created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_events_course_id
  ON public.waitlist_promotion_events (course_id);

-- Lock table down (service role bypasses RLS)
ALTER TABLE public.waitlist_promotion_events ENABLE ROW LEVEL SECURITY;

-- 2) Trigger function: enqueue event on promotion
CREATE OR REPLACE FUNCTION public.enqueue_waitlist_promotion_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Only when status changes from waitlist -> registered
  IF (TG_OP = 'UPDATE') AND OLD.status = 'waitlist' AND NEW.status = 'registered' THEN
    INSERT INTO public.waitlist_promotion_events (registration_id, course_id, user_id)
    SELECT NEW.id, NEW.course_id, NEW.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.waitlist_promotion_events e
      WHERE e.registration_id = NEW.id AND e.notified_at IS NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Trigger on course_registrations updates
DROP TRIGGER IF EXISTS trg_enqueue_waitlist_promotion ON public.course_registrations;
CREATE TRIGGER trg_enqueue_waitlist_promotion
AFTER UPDATE ON public.course_registrations
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.enqueue_waitlist_promotion_event();