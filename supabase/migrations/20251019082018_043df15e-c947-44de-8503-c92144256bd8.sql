-- Step 1: Remove duplicate training sessions, keeping only the oldest entry
-- This handles existing duplicates before creating the UNIQUE constraint

WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, session_date, session_type 
      ORDER BY created_at ASC
    ) as rn
  FROM public.training_sessions
)
DELETE FROM public.training_sessions
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Add UNIQUE constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_unique 
ON public.training_sessions(user_id, session_date, session_type);

-- Add comment to explain the constraint
COMMENT ON INDEX idx_training_sessions_unique IS 'Prevents duplicate training sessions for the same user, date, and session type. Protects against race conditions in auto-completion logic.';