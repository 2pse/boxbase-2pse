-- Erstelle Admin User mit Passwort "2019"
-- WICHTIG: Das Passwort ist gehashed mit bcrypt
-- Das Passwort "2019" entspricht dem Hash: $2a$10$mVSL7WRZRrHzCzB9nQfKV.xLVF.QYb.YqLY4Y0.Yc4w4FJCz9lJm6

INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  raw_user_meta_data
) VALUES (
  gen_random_uuid(),
  'admin@rise-fitness.com',
  '$2a$10$rn/bq/yKwUXSqTHgNSy4D.kOQHnWkYhBZ4QNQQmK6k.qWZe6xnFM2', -- Passwort: 2019
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  '{"full_name": "Administrator"}'::jsonb
)
ON CONFLICT (email) DO NOTHING;

-- Erstelle Profil für Admin (mit temporärer User ID)
INSERT INTO public.profiles (
  id,
  user_id,
  display_name,
  access_code,
  created_at,
  updated_at
) 
SELECT 
  gen_random_uuid(),
  u.id,
  'Administrator',
  '2019',
  now(),
  now()
FROM auth.users u 
WHERE u.email = 'admin@rise-fitness.com'
ON CONFLICT (user_id) DO NOTHING;

-- Weise Admin-Rolle zu
INSERT INTO public.user_roles (
  user_id,
  role,
  created_at
)
SELECT 
  u.id,
  'admin'::app_role,
  now()
FROM auth.users u 
WHERE u.email = 'admin@rise-fitness.com'
ON CONFLICT (user_id, role) DO NOTHING;