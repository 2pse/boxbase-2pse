
-- 1) Admin-Rolle für "Florian Göttinger" entfernen
WITH target AS (
  SELECT user_id
  FROM public.profiles
  WHERE display_name = 'Florian Göttinger'
    AND user_id IS NOT NULL
)
DELETE FROM public.user_roles ur
USING target t
WHERE ur.user_id = t.user_id
  AND ur.role = 'admin'::app_role;

-- 2) Falls das Profil fälschlich als Administrator gekennzeichnet ist, auf Premium Member setzen
UPDATE public.profiles
SET membership_type = CASE
  WHEN membership_type IN ('Administrator','Admin') THEN 'Premium Member'
  ELSE membership_type
END
WHERE display_name = 'Florian Göttinger';
