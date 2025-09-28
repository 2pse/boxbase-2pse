-- First, create a security definer function to check if a user is an author
CREATE OR REPLACE FUNCTION public.is_author(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND authors = true
  )
$$;

-- Update the RLS policy for crossfit_workouts to allow authors to manage workouts
DROP POLICY IF EXISTS "Admins can manage crossfit workouts" ON public.crossfit_workouts;

CREATE POLICY "Admins and authors can manage crossfit workouts"
ON public.crossfit_workouts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_author(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_author(auth.uid()));

-- Also update the policy for bodybuilding_workouts to be consistent
DROP POLICY IF EXISTS "Admins can manage bodybuilding workouts" ON public.bodybuilding_workouts;

CREATE POLICY "Admins and authors can manage bodybuilding workouts"
ON public.bodybuilding_workouts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_author(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_author(auth.uid()));