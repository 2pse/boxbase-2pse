-- Behebe Security Warning: Function Search Path Mutable
-- Aktualisiere die cleanup_old_memberships Funktion mit korrektem search_path
CREATE OR REPLACE FUNCTION public.cleanup_old_memberships()
RETURNS TRIGGER
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Lösche alle anderen aktiven Mitgliedschaften dieses Users
  DELETE FROM public.user_memberships_v2
  WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND status = 'active';
  
  RETURN NEW;
END;
$$;