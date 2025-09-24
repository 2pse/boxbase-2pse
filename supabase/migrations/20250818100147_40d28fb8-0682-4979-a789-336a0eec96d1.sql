-- Phase 3: Kurse und Registrierungen optimieren + RLS Policies

-- 1. RLS Policies für Challenge-System Tabellen
-- Monthly Challenges Policies
CREATE POLICY "Admins can manage challenges" ON public.monthly_challenges
FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active challenges" ON public.monthly_challenges
FOR SELECT USING (NOT is_archived);

-- User Challenge Progress Policies
CREATE POLICY "Users can view their own progress" ON public.user_challenge_progress
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" ON public.user_challenge_progress
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON public.user_challenge_progress
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all progress" ON public.user_challenge_progress
FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Challenge Checkpoints Policies
CREATE POLICY "Users can manage their own checkpoints" ON public.challenge_checkpoints
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all checkpoints" ON public.challenge_checkpoints
FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- User Badges Policies
CREATE POLICY "Users can view their own badges" ON public.user_badges
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own badges" ON public.user_badges
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view all badges" ON public.user_badges
FOR SELECT USING (true);

-- Training Plans Policies
CREATE POLICY "Users can manage their own training plans" ON public.training_plans
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all training plans" ON public.training_plans
FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Waitlist Promotion Events Policies
CREATE POLICY "Admins can manage waitlist events" ON public.waitlist_promotion_events
FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own waitlist events" ON public.waitlist_promotion_events
FOR SELECT USING (auth.uid() = user_id);

-- 2. Erweiterte Kursfunktionen und Constraints

-- Template-Verbindung Foreign Key (optional, da template_id nullable ist)
-- Wir setzen keinen Foreign Key, da Templates möglicherweise gelöscht werden können

-- Verbesserte course registration constraints
-- Stelle sicher, dass registrations nur für aktive Kurse möglich sind
CREATE OR REPLACE FUNCTION public.validate_course_registration()
RETURNS TRIGGER AS $$
BEGIN
  -- Prüfe ob Kurs aktiv ist
  IF NOT EXISTS (
    SELECT 1 FROM public.courses 
    WHERE id = NEW.course_id 
    AND status = 'active' 
    AND NOT is_cancelled
  ) THEN
    RAISE EXCEPTION 'Cannot register for inactive or cancelled course';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger für course registration validation
DROP TRIGGER IF EXISTS validate_course_registration_trigger ON public.course_registrations;
CREATE TRIGGER validate_course_registration_trigger
  BEFORE INSERT ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION validate_course_registration();

-- 3. Waitlist-Management verbessern

-- Funktion zur automatischen Beförderung von der Warteliste
CREATE OR REPLACE FUNCTION public.promote_from_waitlist(course_id_param uuid)
RETURNS void AS $$
DECLARE
  available_spots integer;
  waitlist_record record;
BEGIN
  -- Berechne verfügbare Plätze
  SELECT 
    c.max_participants - COALESCE(COUNT(cr.id), 0) as spots
  INTO available_spots
  FROM public.courses c
  LEFT JOIN public.course_registrations cr ON c.id = cr.course_id 
    AND cr.status = 'registered'
  WHERE c.id = course_id_param
  GROUP BY c.max_participants;

  -- Befördere Nutzer von der Warteliste
  IF available_spots > 0 THEN
    FOR waitlist_record IN
      SELECT user_id, id as registration_id
      FROM public.course_registrations
      WHERE course_id = course_id_param 
        AND status = 'waitlist'
      ORDER BY registered_at
      LIMIT available_spots
    LOOP
      -- Update registration status
      UPDATE public.course_registrations
      SET status = 'registered', updated_at = now()
      WHERE id = waitlist_record.registration_id;
      
      -- Create promotion event for notification
      INSERT INTO public.waitlist_promotion_events (
        registration_id, 
        course_id, 
        user_id,
        payload,
        created_at
      ) VALUES (
        waitlist_record.registration_id,
        course_id_param,
        waitlist_record.user_id,
        jsonb_build_object(
          'promoted_at', now(),
          'available_spots', available_spots
        ),
        now()
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger für automatische Wartelisten-Beförderung bei Stornierungen
CREATE OR REPLACE FUNCTION public.handle_course_cancellation_promotion()
RETURNS TRIGGER AS $$
BEGIN
  -- Nur bei Statusänderung von 'registered' zu 'cancelled'
  IF OLD.status = 'registered' AND NEW.status = 'cancelled' THEN
    PERFORM public.promote_from_waitlist(NEW.course_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update existing trigger or create new one
DROP TRIGGER IF EXISTS course_cancellation_promotion_trigger ON public.course_registrations;
CREATE TRIGGER course_cancellation_promotion_trigger
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION handle_course_cancellation_promotion();

-- 4. Performance Indexes für neue Tabellen
CREATE INDEX IF NOT EXISTS idx_monthly_challenges_year_month 
ON public.monthly_challenges (year, month);

CREATE INDEX IF NOT EXISTS idx_monthly_challenges_active 
ON public.monthly_challenges (is_archived, year, month);

CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_user_id 
ON public.user_challenge_progress (user_id);

CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_challenge_id 
ON public.user_challenge_progress (challenge_id);

CREATE INDEX IF NOT EXISTS idx_challenge_checkpoints_user_challenge 
ON public.challenge_checkpoints (user_id, challenge_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id 
ON public.user_badges (user_id);

CREATE INDEX IF NOT EXISTS idx_training_plans_user_active 
ON public.training_plans (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_waitlist_promotion_events_course_user 
ON public.waitlist_promotion_events (course_id, user_id);

CREATE INDEX IF NOT EXISTS idx_courses_template_id 
ON public.courses (template_id);

-- 5. Update Triggers für neue Tabellen
CREATE TRIGGER update_monthly_challenges_updated_at 
BEFORE UPDATE ON public.monthly_challenges 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_challenge_progress_updated_at 
BEFORE UPDATE ON public.user_challenge_progress 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_plans_updated_at 
BEFORE UPDATE ON public.training_plans 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();