-- Check remaining duplicates
SELECT user_id, date, workout_type, COUNT(*) 
FROM public.training_sessions 
GROUP BY user_id, date, workout_type 
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- Delete all remaining duplicates more aggressively
-- Keep only the training session with the smallest ID for each combination
DELETE FROM public.training_sessions 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM public.training_sessions 
    GROUP BY user_id, date, workout_type
);