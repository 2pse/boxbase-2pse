-- Allow all authenticated users to view display names of all profiles for leaderboard
CREATE POLICY "All users can view display names for leaderboard" 
ON profiles 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);