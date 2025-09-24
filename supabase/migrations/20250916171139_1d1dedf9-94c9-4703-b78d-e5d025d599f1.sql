-- Fix leaderboard calculation system
-- First, create improved function that calculates actual training count
CREATE OR REPLACE FUNCTION public.update_leaderboard_entry(p_user_id uuid, p_session_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  year_val integer;
  month_val integer;
  actual_training_count integer;
BEGIN
  year_val := EXTRACT(YEAR FROM p_session_date);
  month_val := EXTRACT(MONTH FROM p_session_date);
  
  -- Calculate actual training count for this user and month
  SELECT COUNT(*)
  INTO actual_training_count
  FROM public.training_sessions
  WHERE user_id = p_user_id 
    AND EXTRACT(YEAR FROM session_date) = year_val
    AND EXTRACT(MONTH FROM session_date) = month_val;
  
  -- Insert or update with actual count
  INSERT INTO public.leaderboard_entries (user_id, year, month, training_count)
  VALUES (p_user_id, year_val, month_val, actual_training_count)
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET
    training_count = actual_training_count,
    updated_at = now();
END;
$function$;

-- Now correct all existing leaderboard entries with actual training counts
WITH actual_counts AS (
  SELECT 
    user_id,
    EXTRACT(YEAR FROM session_date)::integer as year,
    EXTRACT(MONTH FROM session_date)::integer as month,
    COUNT(*) as actual_count
  FROM public.training_sessions
  GROUP BY user_id, EXTRACT(YEAR FROM session_date), EXTRACT(MONTH FROM session_date)
)
UPDATE public.leaderboard_entries 
SET 
  training_count = COALESCE(actual_counts.actual_count, 0),
  updated_at = now()
FROM actual_counts
WHERE leaderboard_entries.user_id = actual_counts.user_id
  AND leaderboard_entries.year = actual_counts.year
  AND leaderboard_entries.month = actual_counts.month;

-- Remove entries that have no corresponding training sessions
DELETE FROM public.leaderboard_entries 
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.training_sessions ts 
  WHERE ts.user_id = leaderboard_entries.user_id
    AND EXTRACT(YEAR FROM ts.session_date) = leaderboard_entries.year
    AND EXTRACT(MONTH FROM ts.session_date) = leaderboard_entries.month
) AND training_count = 0;