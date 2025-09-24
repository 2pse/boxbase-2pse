-- Remove unique constraint on access_code in profiles table
-- Check if there's a unique constraint on access_code
SELECT tc.constraint_name, tc.constraint_type 
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'profiles' AND ccu.column_name = 'access_code';

-- Check if there's a unique index on access_code
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'profiles' AND indexdef LIKE '%access_code%';

-- Drop unique constraint if it exists (common name patterns)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_access_code_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS unique_access_code;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_access_code_unique;

-- Drop unique index if it exists (common name patterns)
DROP INDEX IF EXISTS profiles_access_code_key;
DROP INDEX IF EXISTS unique_access_code_index;
DROP INDEX IF EXISTS idx_profiles_access_code_unique;