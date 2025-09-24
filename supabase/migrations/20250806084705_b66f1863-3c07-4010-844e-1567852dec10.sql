-- Let's be explicit about the column order
CREATE TEMP TABLE temp_unique_sessions AS
SELECT DISTINCT ON (user_id, date, workout_type) 
    id, user_id, plan_id, date, workout_type, status, 
    created_at, updated_at, completed_at, workout_data, feedback
FROM public.training_sessions
ORDER BY user_id, date, workout_type, created_at ASC;

-- Count duplicates
SELECT 
    (SELECT COUNT(*) FROM public.training_sessions) as total_before,
    (SELECT COUNT(*) FROM temp_unique_sessions) as unique_sessions,
    (SELECT COUNT(*) FROM public.training_sessions) - (SELECT COUNT(*) FROM temp_unique_sessions) as duplicates_to_delete;

-- Clear and repopulate
DELETE FROM public.training_sessions;

INSERT INTO public.training_sessions (id, user_id, plan_id, date, workout_type, status, created_at, updated_at, completed_at, workout_data, feedback)
SELECT id, user_id, plan_id, date, workout_type, status, created_at, updated_at, completed_at, workout_data, feedback
FROM temp_unique_sessions;