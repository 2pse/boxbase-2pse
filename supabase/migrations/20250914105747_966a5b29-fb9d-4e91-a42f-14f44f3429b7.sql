-- Prüfe zuerst ob es einen Trigger gibt und lösche ihn falls vorhanden
DROP TRIGGER IF EXISTS training_session_leaderboard_trigger ON public.training_sessions;
DROP TRIGGER IF EXISTS training_session_insert_trigger ON public.training_sessions;

-- Erstelle einen neuen Trigger für das Leaderboard
CREATE TRIGGER training_session_leaderboard_trigger
  AFTER INSERT ON public.training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leaderboard_with_challenges(NEW.user_id, NEW.session_date);

-- Korrigiere Magnus' Leaderboard-Eintrag basierend auf den tatsächlichen Trainingseinheiten
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
WHERE user_id = '4fde4e5e-ff7a-478b-b8de-f8a6e1f103ec'
  AND year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND month = EXTRACT(MONTH FROM CURRENT_DATE);