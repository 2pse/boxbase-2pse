-- Remove the restrictive max_participants constraint to allow flexible values
ALTER TABLE course_templates DROP CONSTRAINT course_templates_max_participants_check;

-- Add a more flexible constraint that allows any positive value
ALTER TABLE course_templates ADD CONSTRAINT course_templates_max_participants_positive CHECK (max_participants > 0);