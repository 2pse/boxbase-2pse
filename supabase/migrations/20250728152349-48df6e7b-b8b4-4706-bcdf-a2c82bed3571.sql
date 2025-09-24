-- Fix duplicate policy name for leaderboard
DROP POLICY IF EXISTS "Users can update their own leaderboard entry" ON public.leaderboard_entries;

-- Create correct policies for leaderboard entries
CREATE POLICY "Users can insert their own leaderboard entry" ON public.leaderboard_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leaderboard entry" ON public.leaderboard_entries
  FOR UPDATE USING (auth.uid() = user_id);