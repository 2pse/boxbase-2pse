-- Add first_name and last_name columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN first_name text,
ADD COLUMN last_name text;

-- Migrate existing display_name data to first_name (simple split by space)
UPDATE public.profiles 
SET first_name = CASE 
    WHEN display_name IS NOT NULL AND display_name != '' THEN 
        CASE 
            WHEN position(' ' in display_name) > 0 THEN 
                split_part(display_name, ' ', 1)
            ELSE display_name
        END
    ELSE NULL
END,
last_name = CASE 
    WHEN display_name IS NOT NULL AND display_name != '' AND position(' ' in display_name) > 0 THEN 
        substring(display_name from position(' ' in display_name) + 1)
    ELSE NULL
END
WHERE display_name IS NOT NULL AND display_name != '';