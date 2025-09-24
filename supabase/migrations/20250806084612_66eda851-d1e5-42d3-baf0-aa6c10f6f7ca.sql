-- Let's do this step by step
-- First, create a temporary table with only unique entries
CREATE TEMP TABLE temp_unique_sessions AS
SELECT DISTINCT ON (user_id, date, workout_type) 
    id, user_id, date, workout_type, status, created_at, updated_at, 
    completed_at, workout_data, feedback, plan_id
FROM public.training_sessions
ORDER BY user_id, date, workout_type, created_at ASC;

-- Count how many we're keeping vs deleting
SELECT 
    (SELECT COUNT(*) FROM public.training_sessions) as total_before,
    (SELECT COUNT(*) FROM temp_unique_sessions) as unique_sessions,
    (SELECT COUNT(*) FROM public.training_sessions) - (SELECT COUNT(*) FROM temp_unique_sessions) as duplicates_to_delete;

-- Now delete all from the original table
DELETE FROM public.training_sessions;

-- Insert back only the unique ones
INSERT INTO public.training_sessions 
SELECT * FROM temp_unique_sessions;