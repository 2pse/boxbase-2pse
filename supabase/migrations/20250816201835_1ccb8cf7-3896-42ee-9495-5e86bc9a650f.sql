-- Add is_recurring column to monthly_challenges table
ALTER TABLE public.monthly_challenges 
ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;