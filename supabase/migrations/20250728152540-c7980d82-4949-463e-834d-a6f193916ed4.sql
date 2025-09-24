-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  access_code TEXT UNIQUE,
  age INTEGER,
  gender TEXT,
  weight_kg DECIMAL,
  fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  training_frequency_per_week INTEGER,
  session_duration_minutes INTEGER,
  preferences JSONB,
  limitations JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training plans table
CREATE TABLE IF NOT EXISTS public.training_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT NOT NULL CHECK (goal IN ('crossfit', 'bodybuilding', 'weightlifting', 'cardio')),
  duration_weeks INTEGER NOT NULL,
  current_week INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training sessions table (individual workouts)
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  plan_id UUID REFERENCES public.training_plans ON DELETE SET NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'current', 'pending', 'locked')),
  workout_type TEXT CHECK (workout_type IN ('course', 'free_training', 'plan')),
  workout_data JSONB,
  feedback TEXT CHECK (feedback IN ('too_easy', 'perfect', 'too_hard')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leaderboard entries table
CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  training_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (only if they don't exist)
DO $$
BEGIN
  -- Profiles policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view their own profile') THEN
    CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Training plans policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plans' AND policyname = 'Users can view their own training plans') THEN
    CREATE POLICY "Users can view their own training plans" ON public.training_plans FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plans' AND policyname = 'Users can create their own training plans') THEN
    CREATE POLICY "Users can create their own training plans" ON public.training_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plans' AND policyname = 'Users can update their own training plans') THEN
    CREATE POLICY "Users can update their own training plans" ON public.training_plans FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plans' AND policyname = 'Users can delete their own training plans') THEN
    CREATE POLICY "Users can delete their own training plans" ON public.training_plans FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Training sessions policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_sessions' AND policyname = 'Users can view their own training sessions') THEN
    CREATE POLICY "Users can view their own training sessions" ON public.training_sessions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_sessions' AND policyname = 'Users can create their own training sessions') THEN
    CREATE POLICY "Users can create their own training sessions" ON public.training_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_sessions' AND policyname = 'Users can update their own training sessions') THEN
    CREATE POLICY "Users can update their own training sessions" ON public.training_sessions FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  -- Leaderboard policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaderboard_entries' AND policyname = 'Authenticated users can view leaderboard') THEN
    CREATE POLICY "Authenticated users can view leaderboard" ON public.leaderboard_entries FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaderboard_entries' AND policyname = 'Users can insert their own leaderboard entry') THEN
    CREATE POLICY "Users can insert their own leaderboard entry" ON public.leaderboard_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaderboard_entries' AND policyname = 'Users can update their own leaderboard entry') THEN
    CREATE POLICY "Users can update their own leaderboard entry" ON public.leaderboard_entries FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;