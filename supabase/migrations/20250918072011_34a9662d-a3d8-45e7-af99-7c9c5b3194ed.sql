-- Setup automatisches Member-Status-Update System

-- Erstelle einen Cron-Job, der täglich Member-Status basierend auf letzter Aktivität aktualisiert
-- Dies löst automatisch Reaktivierungs-Webhooks aus wenn Status auf inaktiv wechselt

-- Erstelle bessere update_member_status Funktion die Logs schreibt
CREATE OR REPLACE FUNCTION public.update_member_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer := 0;
  inactive_count integer := 0;
  active_count integer := 0;
BEGIN
  -- Log Start
  RAISE NOTICE 'Starting member status update at %', now();
  
  -- Count current statuses for comparison
  SELECT COUNT(*) INTO active_count FROM public.profiles WHERE status = 'active';
  SELECT COUNT(*) INTO inactive_count FROM public.profiles WHERE status = 'inactive';
  
  RAISE NOTICE 'Current status: % active, % inactive', active_count, inactive_count;
  
  -- Simple heuristic: active if recently seen (21 days), else inactive
  -- Only update profiles that actually need status changes
  WITH status_updates AS (
    UPDATE public.profiles 
    SET 
      status = CASE 
        WHEN last_login_at IS NOT NULL AND last_login_at > now() - interval '21 days' THEN 'active'
        ELSE 'inactive'
      END,
      updated_at = now()
    WHERE 
      -- Only update rows where the status would actually change
      (status != 'active' AND last_login_at IS NOT NULL AND last_login_at > now() - interval '21 days')
      OR 
      (status != 'inactive' AND (last_login_at IS NULL OR last_login_at <= now() - interval '21 days'))
    RETURNING user_id, status
  )
  SELECT COUNT(*) INTO updated_count FROM status_updates;
  
  -- Log Results
  RAISE NOTICE 'Member status update completed. Updated % profiles at %', updated_count, now();
  
  -- Count new statuses
  SELECT COUNT(*) INTO active_count FROM public.profiles WHERE status = 'active';
  SELECT COUNT(*) INTO inactive_count FROM public.profiles WHERE status = 'inactive';
  
  RAISE NOTICE 'New status: % active, % inactive', active_count, inactive_count;
END;
$$;

-- Erstelle Cron-Job für tägliche Ausführung um 2:00 Uhr
-- Dies prüft und aktualisiert automatisch Member-Status
SELECT cron.schedule(
  'daily-member-status-update',
  '0 2 * * *', -- Täglich um 2:00 Uhr
  $$
  SELECT public.update_member_status();
  $$
);

-- Teste die Funktion einmal manuell um sicherzustellen dass sie funktioniert
SELECT public.update_member_status();