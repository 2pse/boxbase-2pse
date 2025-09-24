-- Phase 4: Performance und Sicherheit - Finale Optimierungen

-- 1. Zusätzliche wichtige Performance-Indexes
CREATE INDEX IF NOT EXISTS idx_course_registrations_user_status 
ON public.course_registrations (user_id, status);

CREATE INDEX IF NOT EXISTS idx_course_registrations_course_status_registered_at 
ON public.course_registrations (course_id, status, registered_at);

CREATE INDEX IF NOT EXISTS idx_courses_date_status 
ON public.courses (course_date, status);

CREATE INDEX IF NOT EXISTS idx_courses_active_date 
ON public.courses (course_date) WHERE status = 'active' AND NOT is_cancelled;

CREATE INDEX IF NOT EXISTS idx_training_sessions_user_date 
ON public.training_sessions (user_id, session_date);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_news_published 
ON public.news (published_at) WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_user_read_news_user_news 
ON public.user_read_news (user_id, news_id);

-- 2. Erweiterte Datenbankfunktionen für bessere Performance

-- Funktion zur Berechnung der wöchentlichen Registrierungen
CREATE OR REPLACE FUNCTION public.get_weekly_registrations_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.course_registrations cr
  JOIN public.courses c ON cr.course_id = c.id
  WHERE cr.user_id = p_user_id
    AND cr.status = 'registered'
    AND c.course_date >= CURRENT_DATE - INTERVAL '7 days'
    AND c.course_date <= CURRENT_DATE + INTERVAL '7 days';
$$;

-- Verbesserte Funktion zur Überprüfung von Kursregistrierungen
CREATE OR REPLACE FUNCTION public.can_user_register_for_course(p_user_id uuid, p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_membership membership_type;
  user_credits integer;
  course_max_participants integer;
  current_registrations integer;
  course_is_active boolean;
BEGIN
  -- Überprüfe Kurs-Status
  SELECT 
    c.max_participants,
    (c.status = 'active' AND NOT c.is_cancelled) as is_active
  INTO course_max_participants, course_is_active
  FROM public.courses c
  WHERE c.id = p_course_id;

  IF NOT course_is_active THEN
    RETURN false;
  END IF;

  -- Hole Mitgliedschaftsdaten
  SELECT mc.membership_type, mc.credits_remaining
  INTO user_membership, user_credits
  FROM public.membership_credits mc
  WHERE mc.user_id = p_user_id;

  -- Aktuelle Registrierungen zählen
  SELECT COUNT(*)
  INTO current_registrations
  FROM public.course_registrations cr
  WHERE cr.course_id = p_course_id AND cr.status = 'registered';

  -- Prüfe ob Registrierung möglich ist
  RETURN (
    (user_membership = 'unlimited' OR COALESCE(user_credits, 0) > 0)
    AND current_registrations < COALESCE(course_max_participants, 0)
  );
END;
$$;

-- 3. Verbesserte Leaderboard-Aktualisierung mit Challenge-Punkten
CREATE OR REPLACE FUNCTION public.update_leaderboard_with_challenges(p_user_id uuid, p_session_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_val integer;
  month_val integer;
  challenge_bonus integer := 0;
BEGIN
  year_val := EXTRACT(YEAR FROM p_session_date);
  month_val := EXTRACT(MONTH FROM p_session_date);
  
  -- Berechne Challenge-Bonus für diesen Monat
  SELECT COALESCE(SUM(mc.bonus_points), 0)
  INTO challenge_bonus
  FROM public.user_challenge_progress ucp
  JOIN public.monthly_challenges mc ON ucp.challenge_id = mc.id
  WHERE ucp.user_id = p_user_id 
    AND ucp.is_completed = true
    AND mc.year = year_val 
    AND mc.month = month_val;
  
  -- Aktualisiere Leaderboard-Eintrag
  INSERT INTO public.leaderboard_entries (user_id, year, month, training_count, challenge_bonus_points)
  VALUES (p_user_id, year_val, month_val, 1, challenge_bonus)
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET
    training_count = leaderboard_entries.training_count + 1,
    challenge_bonus_points = challenge_bonus,
    updated_at = now();
END;
$$;

-- 4. Trigger-Updates für bessere Leaderboard-Integration
CREATE OR REPLACE FUNCTION public.handle_training_session_insert_enhanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.update_leaderboard_with_challenges(NEW.user_id, NEW.session_date);
  RETURN NEW;
END;
$$;

-- Aktualisiere bestehenden Trigger
DROP TRIGGER IF EXISTS handle_training_session_insert_trigger ON public.training_sessions;
CREATE TRIGGER handle_training_session_insert_trigger
  AFTER INSERT ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION handle_training_session_insert_enhanced();

-- 5. Sicherheitsverbesserungen - Erweiterte RLS Policies

-- Verbesserte Profile-Sicherheit
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles
FOR SELECT USING (true);

-- Sicherheitsrichtlinie für sensitive Daten
CREATE POLICY "Users can only update their own sensitive data" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Challenge-Sicherheit verschärfen
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;
CREATE POLICY "System can insert badges for challenge completion" ON public.user_badges
FOR INSERT WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- 6. Datenvalidierung und Constraints

-- Stelle sicher, dass Challenge-Checkpoints nicht über die maximale Anzahl hinausgehen
CREATE OR REPLACE FUNCTION public.validate_checkpoint_limit()
RETURNS TRIGGER AS $$
DECLARE
  max_checkpoints integer;
BEGIN
  SELECT checkpoint_count INTO max_checkpoints
  FROM public.monthly_challenges
  WHERE id = NEW.challenge_id;
  
  IF NEW.checkpoint_number > max_checkpoints THEN
    RAISE EXCEPTION 'Checkpoint number % exceeds maximum % for this challenge', 
      NEW.checkpoint_number, max_checkpoints;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER validate_checkpoint_limit_trigger
  BEFORE INSERT OR UPDATE ON public.challenge_checkpoints
  FOR EACH ROW EXECUTE FUNCTION validate_checkpoint_limit();

-- 7. Erweiterte Cleanup-Funktionen

-- Funktion zum Archivieren alter Challenges
CREATE OR REPLACE FUNCTION public.archive_old_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.monthly_challenges
  SET is_archived = true, updated_at = now()
  WHERE year < EXTRACT(YEAR FROM CURRENT_DATE) - 1
    AND NOT is_archived;
END;
$$;

-- Funktion zur Bereinigung alter Waitlist-Events
CREATE OR REPLACE FUNCTION public.cleanup_old_waitlist_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.waitlist_promotion_events
  WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
END;
$$;

-- 8. Optimierte Composite Indexes für häufige Abfragen
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_year_month_training_desc 
ON public.leaderboard_entries (year, month, training_count DESC, challenge_bonus_points DESC);

CREATE INDEX IF NOT EXISTS idx_challenge_progress_completed 
ON public.user_challenge_progress (is_completed, completed_at) WHERE is_completed = true;

CREATE INDEX IF NOT EXISTS idx_courses_template_date 
ON public.courses (template_id, course_date) WHERE template_id IS NOT NULL;

-- 9. Realtime-Unterstützung für wichtige Tabellen aktivieren
ALTER TABLE public.monthly_challenges REPLICA IDENTITY FULL;
ALTER TABLE public.user_challenge_progress REPLICA IDENTITY FULL;
ALTER TABLE public.challenge_checkpoints REPLICA IDENTITY FULL;
ALTER TABLE public.user_badges REPLICA IDENTITY FULL;
ALTER TABLE public.course_registrations REPLICA IDENTITY FULL;
ALTER TABLE public.leaderboard_entries REPLICA IDENTITY FULL;