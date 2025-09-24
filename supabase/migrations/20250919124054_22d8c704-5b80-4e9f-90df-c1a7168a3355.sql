-- Add leaderboard_visible field to profiles table
ALTER TABLE public.profiles ADD COLUMN leaderboard_visible boolean NOT NULL DEFAULT true;