-- Add max_participants back to course_templates table
ALTER TABLE course_templates ADD COLUMN max_participants INTEGER NOT NULL DEFAULT 16;

-- Add max_participants back to courses table  
ALTER TABLE courses ADD COLUMN max_participants INTEGER NOT NULL DEFAULT 16;