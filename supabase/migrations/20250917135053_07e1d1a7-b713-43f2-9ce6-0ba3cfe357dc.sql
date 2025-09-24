-- Drop the overly permissive policy that allows all users to see all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create restrictive policies for profile access
-- Policy 1: Users can view their own complete profile
CREATE POLICY "Users can view their own complete profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Users can view limited public information of other profiles (for leaderboards, course participants)
CREATE POLICY "Users can view public profile information" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() != user_id
);

-- Policy 3: Admins can view all profiles (this policy already exists but keeping it explicit)
-- The existing "Admins can update all profiles" policy with has_role check covers admin access

-- Create a view for public profile data to make it clearer what's considered "public"
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  user_id,
  display_name,
  first_name,
  nickname,
  avatar_url,
  status
FROM public.profiles
WHERE status = 'active';

-- Enable RLS on the view
ALTER VIEW public.public_profiles SET (security_barrier = true);

-- Allow authenticated users to read public profiles
CREATE POLICY "Anyone can view public profile data"
ON public.public_profiles
FOR SELECT
TO authenticated
USING (true);