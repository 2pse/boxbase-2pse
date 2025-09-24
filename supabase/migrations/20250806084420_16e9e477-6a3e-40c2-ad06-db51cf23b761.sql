-- First, let's see how many duplicates we have for Ramona specifically
WITH duplicate_sessions AS (
    SELECT user_id, date, workout_type, COUNT(*) as count
    FROM public.training_sessions 
    WHERE user_id = (SELECT user_id FROM profiles WHERE display_name = 'Ramona')
    AND date = '2025-08-06'
    AND workout_type = 'course'
    GROUP BY user_id, date, workout_type
    HAVING COUNT(*) > 1
)
SELECT * FROM duplicate_sessions;

-- Let's delete duplicates more carefully - keep only one per user/date/workout_type
-- This uses a window function to number rows and keep only the first one
DELETE FROM public.training_sessions 
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id, date, workout_type 
            ORDER BY created_at ASC
        ) as rn
        FROM public.training_sessions
    ) ranked
    WHERE rn > 1
);