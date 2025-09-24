-- Add foreign key relationship between leaderboard_entries and profiles
ALTER TABLE leaderboard_entries 
ADD CONSTRAINT leaderboard_entries_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- Also add an index for better performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user_id ON leaderboard_entries(user_id);

-- Update the RLS policies to allow viewing leaderboard with profile data
DROP POLICY IF EXISTS "Authenticated users can view leaderboard" ON leaderboard_entries;

CREATE POLICY "Authenticated users can view leaderboard" 
ON leaderboard_entries 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);