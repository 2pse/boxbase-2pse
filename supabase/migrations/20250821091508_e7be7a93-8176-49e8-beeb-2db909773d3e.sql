-- Ensure the unique constraint is properly applied and clean up any remaining duplicates
-- First check for any remaining duplicates with different session_type combinations
WITH all_duplicates AS (
  SELECT 
    user_id, 
    session_date,
    COUNT(*) as duplicate_count,
    MIN(created_at) as earliest_created
  FROM training_sessions 
  GROUP BY user_id, session_date
  HAVING COUNT(*) > 1
),
duplicates_to_remove AS (
  SELECT ts.id
  FROM training_sessions ts
  JOIN all_duplicates ad ON ts.user_id = ad.user_id AND ts.session_date = ad.session_date
  WHERE ts.created_at > ad.earliest_created
)
DELETE FROM training_sessions 
WHERE id IN (SELECT id FROM duplicates_to_remove);

-- Drop the existing index if it exists and recreate with proper constraint
DROP INDEX IF EXISTS idx_training_sessions_user_date_unique;

-- Create a unique constraint to prevent any duplicate training sessions per user per day
-- This will prevent Magnus or anyone else from having multiple entries for the same day
ALTER TABLE training_sessions 
ADD CONSTRAINT unique_training_sessions_user_date 
UNIQUE (user_id, session_date);