-- Allow all authenticated users to view challenge progress for leaderboard
CREATE POLICY "All users can view challenge progress for leaderboard" 
ON public.user_challenge_progress 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);