-- Add admin policy for profile updates
CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Clean up Magnus Test duplicate data (keep the correct user_id)
DELETE FROM public.profiles 
WHERE user_id = '961ffc0f-710e-4fa6-bdb2-db835d44cb2e' 
  AND display_name = 'Magnus Test';

-- Update the correct Magnus Test record to ensure it has proper data
UPDATE public.profiles 
SET 
  first_name = 'Magnus',
  last_name = 'Test',
  access_code = 'MAGNUS123',
  display_name = 'Magnus Test'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'magnus@test.de' LIMIT 1
);