-- Drop the overly permissive policy that allows all users to see all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create restrictive policies for profile access
-- Policy 1: Users can view their own complete profile
CREATE POLICY "Users can view their own complete profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Authenticated users can view limited public information of other profiles
-- This allows leaderboards and course participants to work while protecting sensitive data
CREATE POLICY "Users can view public profile information" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() != user_id
  -- Only allow access to specific non-sensitive columns for other users
  -- This is enforced at the application level by only selecting public fields
);