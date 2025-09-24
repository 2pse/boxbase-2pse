-- Create profiles table for user data
CREATE TABLE public.profiles (
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
CREATE TABLE public.training_plans (
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
CREATE TABLE public.training_sessions (
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
CREATE TABLE public.leaderboard_entries (
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

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for training plans
CREATE POLICY "Users can view their own training plans" ON public.training_plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own training plans" ON public.training_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own training plans" ON public.training_plans
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own training plans" ON public.training_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for training sessions
CREATE POLICY "Users can view their own training sessions" ON public.training_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own training sessions" ON public.training_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own training sessions" ON public.training_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for leaderboard (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view leaderboard" ON public.leaderboard_entries
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own leaderboard entry" ON public.leaderboard_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own leaderboard entry" ON public.leaderboard_entries
  FOR UPDATE USING (auth.uid() = user_id);

-- Create updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_training_plans_updated_at
  BEFORE UPDATE ON public.training_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_training_sessions_updated_at
  BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_leaderboard_entries_updated_at
  BEFORE UPDATE ON public.leaderboard_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Function to generate training sessions for a plan
CREATE OR REPLACE FUNCTION public.generate_training_sessions(
  p_user_id UUID,
  p_plan_id UUID,
  p_start_date DATE,
  p_sessions_per_week INTEGER,
  p_duration_weeks INTEGER
)
RETURNS void AS $$
DECLARE
  current_date DATE := p_start_date;
  session_count INTEGER := 0;
  total_sessions INTEGER := p_sessions_per_week * p_duration_weeks;
BEGIN
  WHILE session_count < total_sessions LOOP
    -- Skip weekends for simplicity (can be adjusted)
    IF EXTRACT(DOW FROM current_date) NOT IN (0, 6) THEN
      INSERT INTO public.training_sessions (user_id, plan_id, date, status)
      VALUES (
        p_user_id,
        p_plan_id,
        current_date,
        CASE 
          WHEN current_date = p_start_date THEN 'current'
          WHEN current_date < p_start_date THEN 'completed'
          ELSE 'locked'
        END
      );
      session_count := session_count + 1;
    END IF;
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql;