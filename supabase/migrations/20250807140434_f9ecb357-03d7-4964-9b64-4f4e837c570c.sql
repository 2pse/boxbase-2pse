-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Members can view active gym access codes" ON public.gym_access_codes;

-- Create new policy that allows all member types to view active gym access codes
CREATE POLICY "All members can view active gym access codes" 
ON public.gym_access_codes 
FOR SELECT 
USING (
  (is_active = true) 
  AND (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('member'::app_role, 'basic_member'::app_role, 'premium_member'::app_role)
    )
  )
);