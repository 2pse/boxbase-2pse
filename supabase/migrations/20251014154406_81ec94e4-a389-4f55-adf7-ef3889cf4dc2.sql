-- Lösche ALLE Demo-Profile und zugehörige Daten
-- Behalte nur echte Test-Accounts: Max TT, Flo Test, Cris Test, Thomas Beispiel, Tina Claire Toome

-- Liste der zu behaltenden User IDs
DO $$
DECLARE
  keep_users uuid[] := ARRAY[
    '8971c167-a00c-4e93-8c0b-0e94ecdbfe60'::uuid,  -- Max TT
    'c7c7f51c-dc55-4bfc-bf08-feca770ded5b'::uuid,  -- Flo Test
    '3c04bc2c-f2bc-4023-a5c2-e23ee3398a54'::uuid,  -- Cris Test
    'f2161904-e6ff-46e1-8e0e-a59ff1223436'::uuid,  -- Thomas Beispiel
    'f33eb414-9d57-4ff8-ae4c-62e948d8c4ce'::uuid   -- Tina Claire Toome
  ];
BEGIN
  -- Lösche Leaderboard Einträge
  DELETE FROM public.leaderboard_entries
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche Training Sessions
  DELETE FROM public.training_sessions
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche Course Registrations
  DELETE FROM public.course_registrations
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche User Challenge Progress
  DELETE FROM public.user_challenge_progress
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche User Badges
  DELETE FROM public.user_badges
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche Challenge Checkpoints
  DELETE FROM public.challenge_checkpoints
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche User Read News
  DELETE FROM public.user_read_news
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche Waitlist Promotion Events
  DELETE FROM public.waitlist_promotion_events
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche Reactivation Webhook Events
  DELETE FROM public.reactivation_webhook_events
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche Revenue History
  DELETE FROM public.revenue_history
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche User Memberships V2
  DELETE FROM public.user_memberships_v2
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche User Roles
  DELETE FROM public.user_roles
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  -- Lösche Profile
  DELETE FROM public.profiles
  WHERE user_id NOT IN (SELECT unnest(keep_users));

  RAISE NOTICE 'Demo-Daten erfolgreich gelöscht. Behalten: % Profile', array_length(keep_users, 1);
END $$;