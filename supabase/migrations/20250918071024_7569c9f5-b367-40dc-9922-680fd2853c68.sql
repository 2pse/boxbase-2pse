-- Erstelle präzises Aktivitäts-Tracking System

-- Neue Funktion zum Markieren von echten Benutzeraktivitäten
CREATE OR REPLACE FUNCTION public.mark_user_as_active(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Aktualisiere Benutzer-Status und letzte Aktivität nur bei echten Aktivitäten
  UPDATE public.profiles
  SET 
    last_login_at = now(),
    status = 'active',
    updated_at = now(),
    reactivation_webhook_sent_at = NULL  -- Reset webhook tracking
  WHERE user_id = user_id_param;
END;
$$;

-- Aktualisiere Login-Trigger: Weniger aggressiv, nur bei echten Logins
CREATE OR REPLACE FUNCTION public.handle_user_login_improved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Nur update bei echtem Login (nicht bei Session-Refresh)
  -- Prüfe ob es ein echter Login ist: mindestens 1 Stunde zwischen letzten Logins
  IF NEW.last_sign_in_at IS NOT NULL AND 
     (OLD.last_sign_in_at IS NULL OR 
      NEW.last_sign_in_at > OLD.last_sign_in_at AND 
      NEW.last_sign_in_at > COALESCE(OLD.last_sign_in_at, '1900-01-01'::timestamp) + interval '1 hour') THEN
    
    UPDATE public.profiles
    SET 
      last_login_at = NEW.last_sign_in_at,
      status = 'active',
      updated_at = now(),
      reactivation_webhook_sent_at = NULL  -- Reset webhook tracking bei echtem Login
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;