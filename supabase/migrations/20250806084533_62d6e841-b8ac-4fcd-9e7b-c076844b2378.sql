-- Check remaining duplicates
SELECT user_id, date, workout_type, COUNT(*) 
FROM public.training_sessions 
GROUP BY user_id, date, workout_type 
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- Delete all remaining duplicates, keeping the oldest one
DELETE FROM public.training_sessions 
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, date, workout_type 
                   ORDER BY created_at ASC
               ) as rn
        FROM public.training_sessions
    ) ranked
    WHERE rn > 1
);