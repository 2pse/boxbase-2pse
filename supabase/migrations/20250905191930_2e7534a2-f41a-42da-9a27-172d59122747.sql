-- First, let's check current triggers on training_sessions
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'training_sessions';

-- Remove redundant triggers and keep only the enhanced one
DROP TRIGGER IF EXISTS handle_training_session_insert_trigger ON public.training_sessions;
DROP TRIGGER IF EXISTS handle_training_session_insert_enhanced_trigger ON public.training_sessions;

-- Create the correct trigger (only one)
CREATE TRIGGER handle_training_session_insert_enhanced_trigger
  AFTER INSERT ON public.training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_training_session_insert_enhanced();

-- Fix existing leaderboard entries by recalculating them based on actual training sessions
-- First, clear all existing entries to avoid duplicates
DELETE FROM public.leaderboard_entries;

-- Recalculate correct leaderboard entries from training_sessions
INSERT INTO public.leaderboard_entries (user_id, year, month, training_count, challenge_bonus_points)
SELECT 
  user_id,
  EXTRACT(YEAR FROM session_date) as year,
  EXTRACT(MONTH FROM session_date) as month,
  COUNT(*) as training_count,
  0 as challenge_bonus_points
FROM public.training_sessions
WHERE session_date IS NOT NULL
GROUP BY user_id, EXTRACT(YEAR FROM session_date), EXTRACT(MONTH FROM session_date)
ON CONFLICT (user_id, year, month) 
DO UPDATE SET
  training_count = EXCLUDED.training_count,
  updated_at = now();