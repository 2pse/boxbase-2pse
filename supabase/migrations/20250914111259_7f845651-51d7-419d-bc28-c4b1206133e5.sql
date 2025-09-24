-- Aktualisiere Flos Leaderboard-Eintrag mit den korrekten Challenge-Bonus-Punkten
UPDATE public.leaderboard_entries 
SET 
  challenge_bonus_points = (
    SELECT COALESCE(SUM(mc.bonus_points), 0)
    FROM public.user_badges ub
    JOIN public.monthly_challenges mc ON ub.challenge_id = mc.id
    WHERE ub.user_id = leaderboard_entries.user_id 
      AND mc.year = leaderboard_entries.year 
      AND mc.month = leaderboard_entries.month
  ),
  updated_at = now()
WHERE user_id = '1c869706-4fe4-43e2-a4f7-c7befa1b46d6'
  AND year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND month = EXTRACT(MONTH FROM CURRENT_DATE);

-- Erstelle eine Funktion die bei Badge-Erstellung das Leaderboard aktualisiert
CREATE OR REPLACE FUNCTION public.update_leaderboard_on_badge_earned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_year integer;
  challenge_month integer;
  bonus_points integer;
BEGIN
  -- Hole Jahr, Monat und Bonus-Punkte der Challenge
  SELECT mc.year, mc.month, mc.bonus_points
  INTO challenge_year, challenge_month, bonus_points
  FROM public.monthly_challenges mc
  WHERE mc.id = NEW.challenge_id;

  -- Aktualisiere das Leaderboard für diesen Benutzer, Jahr und Monat
  UPDATE public.leaderboard_entries
  SET 
    challenge_bonus_points = challenge_bonus_points + bonus_points,
    updated_at = now()
  WHERE user_id = NEW.user_id
    AND year = challenge_year
    AND month = challenge_month;

  -- Falls kein Leaderboard-Eintrag existiert, erstelle einen
  INSERT INTO public.leaderboard_entries (user_id, year, month, training_count, challenge_bonus_points)
  VALUES (NEW.user_id, challenge_year, challenge_month, 0, bonus_points)
  ON CONFLICT (user_id, year, month) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Erstelle einen Trigger für Badge-Erstellung
DROP TRIGGER IF EXISTS badge_leaderboard_update_trigger ON public.user_badges;
CREATE TRIGGER badge_leaderboard_update_trigger
  AFTER INSERT ON public.user_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leaderboard_on_badge_earned();