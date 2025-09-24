-- Erstelle einen korrekten Trigger für das Leaderboard
CREATE OR REPLACE TRIGGER training_session_leaderboard_trigger
  AFTER INSERT ON public.training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leaderboard_with_challenges();

-- Korrigiere alle Leaderboard-Einträge basierend auf den tatsächlichen Trainingseinheiten
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
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND month = EXTRACT(MONTH FROM CURRENT_DATE);