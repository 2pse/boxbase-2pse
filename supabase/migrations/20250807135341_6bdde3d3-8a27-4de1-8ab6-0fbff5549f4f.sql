-- Fix RLS policies for leaderboard_entries to allow admins to view all entries
CREATE POLICY "Admins can view all leaderboard entries" 
ON public.leaderboard_entries 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));