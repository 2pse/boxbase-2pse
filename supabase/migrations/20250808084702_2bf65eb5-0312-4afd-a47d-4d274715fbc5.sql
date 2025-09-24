-- Cleanup redundant waitlist trigger and unused function without changing functionality
-- Keep: process_waitlists_on_cancellation + waitlist_promotion_events webhook trigger
-- Remove: duplicate unified trigger and unused generic updated_at function

BEGIN;

-- 1) Drop redundant unified waitlist processing trigger
DROP TRIGGER IF EXISTS trg_unified_waitlist_processing ON public.course_registrations;

-- 2) Drop unused function (no triggers reference this; we use update_updated_at_column instead)
DROP FUNCTION IF EXISTS public.update_updated_at();

COMMIT;