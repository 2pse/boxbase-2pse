-- Fix missing foreign key constraint between user_challenge_progress and monthly_challenges
ALTER TABLE public.user_challenge_progress 
ADD CONSTRAINT fk_user_challenge_progress_challenge_id 
FOREIGN KEY (challenge_id) 
REFERENCES public.monthly_challenges(id) 
ON DELETE CASCADE;