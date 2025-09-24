-- Clean up duplicate training sessions for user with 999 sessions
DELETE FROM training_sessions 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY user_id, date ORDER BY created_at DESC) as rn
    FROM training_sessions 
    WHERE user_id = 'a5ffd9bf-7f8a-41ea-88eb-234277a6a52b'
  ) t 
  WHERE rn > 1
);