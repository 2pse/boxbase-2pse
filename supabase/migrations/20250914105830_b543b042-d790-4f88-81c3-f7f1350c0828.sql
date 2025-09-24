-- Erstelle einen korrekten Trigger für das Leaderboard
CREATE OR REPLACE TRIGGER training_session_leaderboard_trigger
  AFTER INSERT ON public.training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_training_session_insert_enhanced();

-- Korrigiere alle Leaderboard-Einträge basierend auf den tatsächlichen Trainingseinheiten für September 2025
UPDATE public.leaderboard_entries 
SET 
  training_count = (
    SELECT COUNT(*) 
    FROM public.training_sessions ts 
    WHERE ts.user_id = leaderboard_entries.user_id 
      AND EXTRACT(YEAR FROM ts.session_date) = leaderboard_entries.year 
      AND EXTRACT(MONTH FROM ts.session_date) = leaderboard_entries.month
  ),
  updated_at = now()
WHERE year = 2025 AND month = 9;