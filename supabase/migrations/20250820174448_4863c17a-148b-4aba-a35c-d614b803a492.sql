-- Clean up duplicate training sessions and prevent future duplicates
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY user_id, DATE(created_at) ORDER BY created_at) as rn
  FROM training_sessions 
  WHERE training_type = 'course'
)
DELETE FROM training_sessions 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint to prevent duplicate training sessions per user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_user_date_unique 
ON training_sessions (user_id, DATE(created_at), training_type);