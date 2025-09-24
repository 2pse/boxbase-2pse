-- Cleanup ghost memberships that don't have corresponding profiles
DELETE FROM public.user_memberships_v2 
WHERE user_id NOT IN (
  SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL
);

-- Add trigger to automatically delete memberships when profile is deleted
CREATE OR REPLACE FUNCTION public.cleanup_user_memberships_on_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all memberships for this user
  DELETE FROM public.user_memberships_v2 
  WHERE user_id = OLD.user_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger that fires after profile deletion
CREATE TRIGGER cleanup_memberships_after_profile_delete
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_memberships_on_profile_delete();