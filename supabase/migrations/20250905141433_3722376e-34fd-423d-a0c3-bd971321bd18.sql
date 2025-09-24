-- Step 1: Datenbereinigung - Lösche orphaned memberships (User existiert nicht mehr)
DELETE FROM public.user_memberships_v2 
WHERE user_id NOT IN (
  SELECT id FROM auth.users
);

-- Step 2: Lösche duplicate active memberships - behalte nur die neueste pro User
WITH ranked_memberships AS (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
  FROM public.user_memberships_v2 
  WHERE status = 'active'
)
DELETE FROM public.user_memberships_v2
WHERE id IN (
  SELECT id FROM ranked_memberships WHERE rn > 1
);

-- Step 3: Erstelle Funktion zum automatischen Löschen alter Mitgliedschaften
CREATE OR REPLACE FUNCTION public.cleanup_old_memberships()
RETURNS TRIGGER AS $$
BEGIN
  -- Lösche alle anderen aktiven Mitgliedschaften dieses Users
  DELETE FROM public.user_memberships_v2
  WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND status = 'active';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 4: Trigger für automatische Bereinigung bei Insert/Update
DROP TRIGGER IF EXISTS cleanup_memberships_trigger ON public.user_memberships_v2;
CREATE TRIGGER cleanup_memberships_trigger
  AFTER INSERT OR UPDATE OF status ON public.user_memberships_v2
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.cleanup_old_memberships();

-- Step 5: Eindeutigkeits-Constraint für aktive Mitgliedschaften
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_unique_active_membership 
ON public.user_memberships_v2 (user_id) 
WHERE status = 'active';