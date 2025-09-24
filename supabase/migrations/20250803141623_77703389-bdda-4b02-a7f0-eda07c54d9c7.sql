-- Clean up old workout tables
DROP TABLE IF EXISTS workout_exercises CASCADE;
DROP TABLE IF EXISTS workout_parts CASCADE;
DROP TABLE IF EXISTS workout_scalings CASCADE;
DROP TABLE IF EXISTS workouts CASCADE;
DROP TABLE IF EXISTS workouts_rag CASCADE;

-- Add authors field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS authors BOOLEAN DEFAULT FALSE;

-- Create crossfit_workouts table
CREATE TABLE crossfit_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  workout_type TEXT NOT NULL, -- 'WOD' or 'Weightlifting'
  author_nickname TEXT NOT NULL,
  workout_content TEXT NOT NULL,
  notes TEXT,
  scaling_beginner TEXT,
  scaling_scaled TEXT,
  scaling_rx TEXT,
  required_exercises JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bodybuilding_workouts table
CREATE TABLE bodybuilding_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  focus_area TEXT NOT NULL, -- 'Push', 'Pull', 'Legs', 'Upper', 'Full'
  difficulty TEXT NOT NULL, -- 'Beginner', 'Intermediate', 'Pro'
  workout_content TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE crossfit_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodybuilding_workouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crossfit_workouts
CREATE POLICY "Anyone can view crossfit workouts" ON crossfit_workouts FOR SELECT USING (true);
CREATE POLICY "Authors can create crossfit workouts" ON crossfit_workouts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND authors = true)
);
CREATE POLICY "Authors can update their own crossfit workouts" ON crossfit_workouts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND authors = true AND nickname = author_nickname)
);
CREATE POLICY "Admins can manage all crossfit workouts" ON crossfit_workouts FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policies for bodybuilding_workouts
CREATE POLICY "Anyone can view bodybuilding workouts" ON bodybuilding_workouts FOR SELECT USING (true);
CREATE POLICY "Admins can manage bodybuilding workouts" ON bodybuilding_workouts FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add update triggers
CREATE TRIGGER update_crossfit_workouts_updated_at
  BEFORE UPDATE ON crossfit_workouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bodybuilding_workouts_updated_at
  BEFORE UPDATE ON bodybuilding_workouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();