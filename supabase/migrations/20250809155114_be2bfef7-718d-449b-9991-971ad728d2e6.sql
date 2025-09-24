-- Fix and harden admin role sync to avoid failing nickname updates
CREATE OR REPLACE FUNCTION public.sync_admin_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only act on UPDATE when membership_type actually changes
  IF TG_OP = 'UPDATE' AND (NEW.membership_type IS NOT DISTINCT FROM OLD.membership_type) THEN
    RETURN NEW;
  END IF;

  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NEW.user_id IS NOT NULL AND NEW.membership_type IN ('Administrator','Admin') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.user_id, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      -- Remove admin role if membership no longer Administrator/Admin
      DELETE FROM public.user_roles
      WHERE user_id = NEW.user_id
        AND role = 'admin'::public.app_role
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = NEW.user_id
            AND p.membership_type IN ('Administrator','Admin')
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;