-- Manually mark Magnus (Magnus Gottinger) as inactive for testing
UPDATE profiles 
SET status = 'inactive', updated_at = now()
WHERE display_name = 'Magnus' AND access_code = '2001';

-- Check the update
SELECT user_id, display_name, access_code, membership_type, status 
FROM profiles 
WHERE display_name = 'Magnus' AND access_code = '2001';