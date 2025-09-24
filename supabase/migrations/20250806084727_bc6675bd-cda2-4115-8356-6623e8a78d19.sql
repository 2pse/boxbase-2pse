-- Add unique constraint to prevent future duplicates
ALTER TABLE public.training_sessions 
ADD CONSTRAINT unique_user_date_workout_type 
UNIQUE (user_id, date, workout_type);

-- Fix the leaderboard
DELETE FROM public.leaderboard_entries;

INSERT INTO public.leaderboard_entries (user_id, year, month, training_count)
SELECT 
    ts.user_id,
    EXTRACT(YEAR FROM ts.date)::INTEGER as year,
    EXTRACT(MONTH FROM ts.date)::INTEGER as month,
    COUNT(*) as training_count
FROM public.training_sessions ts
WHERE ts.status = 'completed'
GROUP BY ts.user_id, EXTRACT(YEAR FROM ts.date), EXTRACT(MONTH FROM ts.date);

-- Show the corrected leaderboard data
SELECT p.display_name, le.year, le.month, le.training_count
FROM public.leaderboard_entries le
JOIN public.profiles p ON le.user_id = p.user_id
WHERE p.display_name IN ('Magnus', 'Ramona')
ORDER BY p.display_name, le.year DESC, le.month DESC;