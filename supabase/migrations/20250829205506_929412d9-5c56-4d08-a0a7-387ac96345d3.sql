-- Add last_recharged_at column to membership_credits if not exists
ALTER TABLE public.membership_credits 
ADD COLUMN IF NOT EXISTS last_recharged_at TIMESTAMP WITH TIME ZONE;