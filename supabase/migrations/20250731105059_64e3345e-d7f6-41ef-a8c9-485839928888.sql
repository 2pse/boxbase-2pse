-- Create workouts table with enhanced structure
CREATE TABLE public.workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  workout_type TEXT NOT NULL CHECK (workout_type IN ('crossfit', 'bodybuilding', 'weightlifting', 'cardio')),
  session_type TEXT NOT NULL CHECK (session_type IN ('wod_only', 'full_session', 'strength_only', 'weightlifting_only')),
  duration_minutes INTEGER NOT NULL,
  focus_area TEXT NOT NULL CHECK (focus_area IN ('upper_body', 'lower_body', 'full_body', 'core', 'cardio')),
  difficulty_level TEXT NOT NULL CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  required_equipment TEXT[] DEFAULT '{}',
  required_exercises TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workout_parts table for individual workout sections
CREATE TABLE public.workout_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL, -- 'warm_up', 'strength', 'wod', 'cool_down'
  part_order INTEGER NOT NULL,
  score_type TEXT, -- 'for_time', 'amrap', 'emom', 'tabata', 'rounds', null for strength
  duration_minutes INTEGER,
  duration_rounds INTEGER,
  description TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workout_exercises table for exercises within each part
CREATE TABLE public.workout_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_part_id UUID NOT NULL REFERENCES public.workout_parts(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  exercise_order INTEGER NOT NULL,
  reps INTEGER,
  weight_kg NUMERIC,
  percentage_1rm INTEGER,
  distance_meters INTEGER,
  duration_seconds INTEGER,
  rest_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workout_scalings table for different scaling options
CREATE TABLE public.workout_scalings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_exercise_id UUID NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  scaling_type TEXT NOT NULL CHECK (scaling_type IN ('rx', 'scaled', 'beginner')),
  reps INTEGER,
  weight_kg NUMERIC,
  exercise_substitute TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_scalings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workouts
CREATE POLICY "Anyone can view workouts" ON public.workouts FOR SELECT USING (true);
CREATE POLICY "Admins can manage workouts" ON public.workouts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create RLS policies for workout_parts
CREATE POLICY "Anyone can view workout parts" ON public.workout_parts FOR SELECT USING (true);
CREATE POLICY "Admins can manage workout parts" ON public.workout_parts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create RLS policies for workout_exercises
CREATE POLICY "Anyone can view workout exercises" ON public.workout_exercises FOR SELECT USING (true);
CREATE POLICY "Admins can manage workout exercises" ON public.workout_exercises FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create RLS policies for workout_scalings
CREATE POLICY "Anyone can view workout scalings" ON public.workout_scalings FOR SELECT USING (true);
CREATE POLICY "Admins can manage workout scalings" ON public.workout_scalings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_workout_parts_workout_id ON public.workout_parts(workout_id);
CREATE INDEX idx_workout_exercises_workout_part_id ON public.workout_exercises(workout_part_id);
CREATE INDEX idx_workout_scalings_exercise_id ON public.workout_scalings(workout_exercise_id);
CREATE INDEX idx_workouts_type_session ON public.workouts(workout_type, session_type);
CREATE INDEX idx_workouts_required_exercises ON public.workouts USING GIN(required_exercises);

-- Create trigger for updated_at
CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON public.workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update the match_workouts function to work with new structure
CREATE OR REPLACE FUNCTION public.match_workouts_v2(
  query_embedding vector,
  workout_type_param TEXT DEFAULT NULL,
  session_type_param TEXT DEFAULT NULL,
  duration_minutes_param INTEGER DEFAULT NULL,
  focus_area_param TEXT DEFAULT NULL,
  user_preferred_exercises TEXT[] DEFAULT '{}',
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 5
) RETURNS TABLE(
  workout_id uuid,
  title text,
  workout_type text,
  session_type text,
  duration_minutes integer,
  focus_area text,
  difficulty_level text,
  similarity double precision
) LANGUAGE sql STABLE AS $$
  SELECT 
    w.id as workout_id,
    w.title,
    w.workout_type,
    w.session_type,
    w.duration_minutes,
    w.focus_area,
    w.difficulty_level,
    1 - (wr.embedding <=> query_embedding) as similarity
  FROM public.workouts w
  LEFT JOIN public.workouts_rag wr ON w.id = wr.workout_id
  WHERE wr.embedding IS NOT NULL
    AND 1 - (wr.embedding <=> query_embedding) > match_threshold
    AND (workout_type_param IS NULL OR w.workout_type = workout_type_param)
    AND (session_type_param IS NULL OR w.session_type = session_type_param)
    AND (duration_minutes_param IS NULL OR ABS(w.duration_minutes - duration_minutes_param) <= 15)
    AND (focus_area_param IS NULL OR w.focus_area = focus_area_param)
    AND (
      array_length(user_preferred_exercises, 1) IS NULL 
      OR array_length(w.required_exercises, 1) IS NULL
      OR w.required_exercises && user_preferred_exercises
    )
  ORDER BY wr.embedding <=> query_embedding
  LIMIT match_count;
$$;