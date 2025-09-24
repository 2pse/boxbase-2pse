-- Update profiles table to include all needed fields for user profile
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birth_year INTEGER,
ADD COLUMN IF NOT EXISTS front_squat_1rm NUMERIC,
ADD COLUMN IF NOT EXISTS back_squat_1rm NUMERIC,
ADD COLUMN IF NOT EXISTS deadlift_1rm NUMERIC,
ADD COLUMN IF NOT EXISTS bench_press_1rm NUMERIC,
ADD COLUMN IF NOT EXISTS snatch_1rm NUMERIC,
ADD COLUMN IF NOT EXISTS clean_and_jerk_1rm NUMERIC,
ADD COLUMN IF NOT EXISTS extra_lifts JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS preferred_exercises JSONB DEFAULT '[]';