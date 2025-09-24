-- Erstelle das Admin-Profil direkt
-- Verwende eine spezielle Admin-UUID
INSERT INTO public.profiles (
  id,
  user_id,
  display_name,
  access_code,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::uuid, -- Spezielle Admin UUID
  'Administrator',
  '2019',
  now(),
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  access_code = EXCLUDED.access_code;

-- Erstelle Admin-Rolle für die spezielle UUID
INSERT INTO public.user_roles (
  user_id,
  role,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'admin'::app_role,
  now()
) ON CONFLICT (user_id, role) DO NOTHING;