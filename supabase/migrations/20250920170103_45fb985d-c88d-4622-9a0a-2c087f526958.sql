-- Add workout visibility settings to gym_settings table
ALTER TABLE public.gym_settings 
ADD COLUMN show_functional_fitness_workouts boolean NOT NULL DEFAULT true,
ADD COLUMN show_bodybuilding_workouts boolean NOT NULL DEFAULT true;