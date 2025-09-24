
-- 1) RLS anpassen: Nur Admins dürfen Kursvorlagen einfügen
ALTER TABLE public.course_templates ENABLE ROW LEVEL SECURITY;

-- Entferne alte Policy, falls vorhanden
DROP POLICY IF EXISTS "Admins and trainers can insert course templates" ON public.course_templates;

-- Explizite Insert-Policy nur für Admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_templates'
      AND policyname = 'Admins can insert course templates'
  ) THEN
    CREATE POLICY "Admins can insert course templates"
      ON public.course_templates
      FOR INSERT
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Hinweis: Es existiert bereits eine Policy "Admins can manage course templates" (ALL).
-- Die obige Insert-Policy stellt explizit klar, dass nur Admins einfügen dürfen.


-- 2) Admin-Rollen nachpflegen
-- a) Über Profile (membership_type = 'Administrator' oder 'Admin')
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::app_role
FROM public.profiles p
LEFT JOIN public.user_roles ur
  ON ur.user_id = p.user_id AND ur.role = 'admin'::app_role
WHERE p.user_id IS NOT NULL
  AND p.membership_type IN ('Administrator', 'Admin')
  AND ur.id IS NULL;

-- b) Über bekannte Admin-E-Mails (falls zutreffend)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
LEFT JOIN public.user_roles ur
  ON ur.user_id = u.id AND ur.role = 'admin'::app_role
WHERE u.email IN ('admin@rise-fitness.com', 'risefitness2019@gmail.com')
  AND ur.id IS NULL;


-- 3) Trigger: admin-Rolle automatisch aus dem Profil synchronisieren
CREATE OR REPLACE FUNCTION public.sync_admin_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NEW.user_id IS NOT NULL AND NEW.membership_type IN ('Administrator','Admin') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.user_id, 'admin'::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      -- Entferne admin-Rolle, wenn Membership nicht mehr Administrator ist
      DELETE FROM public.user_roles
      WHERE user_id = NEW.user_id
        AND role = 'admin'::app_role
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = NEW.user_id
            AND p.membership_type IN ('Administrator','Admin')
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_admin_role_from_profile ON public.profiles;

CREATE TRIGGER trg_sync_admin_role_from_profile
AFTER INSERT OR UPDATE OF membership_type, user_id
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_admin_role_from_profile();
