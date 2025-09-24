-- Update training_sessions table constraint to allow new workout types
ALTER TABLE public.training_sessions DROP CONSTRAINT IF EXISTS training_sessions_workout_type_check;

-- Add new constraint with all valid workout types
ALTER TABLE public.training_sessions ADD CONSTRAINT training_sessions_workout_type_check 
CHECK (workout_type IN ('crossfit_wod_only', 'crossfit_full_session', 'bodybuilding_full_session'));