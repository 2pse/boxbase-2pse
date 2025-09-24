-- Fix leaderboard calculation system
-- Replace the existing update_leaderboard_entry function with proper counting logic

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

-- Recalculate all existing leaderboard entries to fix incorrect data
DO $$
DECLARE
  entry RECORD;
  actual_count integer;
BEGIN
  FOR entry IN 
    SELECT DISTINCT user_id, year, month 
    FROM public.leaderboard_entries
  LOOP
    -- Calculate actual training count for this entry
    SELECT COUNT(*)
    INTO actual_count
    FROM public.training_sessions
    WHERE user_id = entry.user_id
      AND EXTRACT(YEAR FROM session_date) = entry.year
      AND EXTRACT(MONTH FROM session_date) = entry.month;
    
    -- Update with correct count
    UPDATE public.leaderboard_entries
    SET training_count = actual_count,
        updated_at = now()
    WHERE user_id = entry.user_id
      AND year = entry.year
      AND month = entry.month;
  END LOOP;
END;
$$;