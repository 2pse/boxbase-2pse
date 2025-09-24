-- Delete orphaned user_memberships that don't have corresponding profiles
DELETE FROM public.user_memberships 
WHERE user_id NOT IN (
  SELECT user_id FROM public.profiles
);

-- Add foreign key constraint to prevent future orphaned memberships
ALTER TABLE public.user_memberships 
ADD CONSTRAINT fk_user_memberships_profiles 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;