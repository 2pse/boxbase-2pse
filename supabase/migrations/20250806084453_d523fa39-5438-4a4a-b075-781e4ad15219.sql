-- Now add the unique constraint to prevent future duplicates
ALTER TABLE public.training_sessions 
ADD CONSTRAINT unique_user_date_workout_type 
UNIQUE (user_id, date, workout_type);

-- Recalculate leaderboard entries to fix the counts
DELETE FROM public.leaderboard_entries;

-- Recreate leaderboard entries with correct counts
INSERT INTO public.leaderboard_entries (user_id, year, month, training_count)
SELECT 
    ts.user_id,
    EXTRACT(YEAR FROM ts.date)::INTEGER as year,
    EXTRACT(MONTH FROM ts.date)::INTEGER as month,
    COUNT(*) as training_count
FROM public.training_sessions ts
WHERE ts.status = 'completed'
GROUP BY ts.user_id, EXTRACT(YEAR FROM ts.date), EXTRACT(MONTH FROM ts.date);