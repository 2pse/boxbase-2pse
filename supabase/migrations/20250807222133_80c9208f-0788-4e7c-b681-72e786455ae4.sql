-- Ensure events table exists, clean duplicates, then add constraints and trigger
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.waitlist_promotion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL,
  course_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ NULL,
  payload JSONB NULL
);

-- 0) Deduplicate pending events per registration_id (keep oldest)
WITH dedup AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY registration_id ORDER BY created_at) AS rn
  FROM public.waitlist_promotion_events
  WHERE notified_at IS NULL
)
DELETE FROM public.waitlist_promotion_events e
USING dedup d
WHERE e.id = d.id AND d.rn > 1;

-- 1) Unique partial index to prevent future duplicates
DO $$ BEGIN
  CREATE UNIQUE INDEX ux_waitlist_events_registration_pending
    ON public.waitlist_promotion_events (registration_id)
    WHERE notified_at IS NULL;
EXCEPTION WHEN duplicate_table THEN
  -- index exists
  NULL;
WHEN duplicate_object THEN
  NULL;
END $$;

-- 2) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_events_created_at
  ON public.waitlist_promotion_events (created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_events_course_id
  ON public.waitlist_promotion_events (course_id);

-- 3) RLS
ALTER TABLE public.waitlist_promotion_events ENABLE ROW LEVEL SECURITY;

-- 4) Trigger function to enqueue event on promotion
CREATE OR REPLACE FUNCTION public.enqueue_waitlist_promotion_event()
RETURNS TRIGGER AS $$
BEGIN
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

-- 5) Trigger on course_registrations
DROP TRIGGER IF EXISTS trg_enqueue_waitlist_promotion ON public.course_registrations;
CREATE TRIGGER trg_enqueue_waitlist_promotion
AFTER UPDATE ON public.course_registrations
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.enqueue_waitlist_promotion_event();