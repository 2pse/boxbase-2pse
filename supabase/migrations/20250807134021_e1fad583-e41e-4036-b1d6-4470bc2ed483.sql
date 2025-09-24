-- Update bodybuilding_workouts focus_area and difficulty values to match UI
-- Focus areas: "Push", "Pull", "Legs", "Upper", "Full" 
-- Difficulties: "Beginner", "Intermediate", "Pro"

-- First update the focus_area values based on workout content
UPDATE bodybuilding_workouts 
SET focus_area = CASE 
  WHEN title ILIKE '%pull%' THEN 'Pull'
  WHEN title ILIKE '%push%' THEN 'Push' 
  WHEN title ILIKE '%leg%' OR title ILIKE '%bein%' THEN 'Legs'
  WHEN title ILIKE '%upper%' OR title ILIKE '%oberkörper%' THEN 'Upper'
  ELSE 'Full'
END;

-- Update difficulty values to match UI expectations
UPDATE bodybuilding_workouts 
SET difficulty = CASE 
  WHEN difficulty = 'Leicht' THEN 'Beginner'
  WHEN difficulty = 'Mittel' THEN 'Intermediate' 
  WHEN difficulty = 'Schwer' THEN 'Pro'
  ELSE 'Beginner'
END;

-- Add some sample workouts for each focus area if needed
INSERT INTO bodybuilding_workouts (title, focus_area, difficulty, workout_content, notes) VALUES
('Chest & Triceps Focus', 'Push', 'Beginner', 'Brustpresse 3x10, Schulterdrücken 3x10, Dips 3x8, Trizepsdrücken 3x12', 'Fokus auf Push-Bewegungen'),
('Back & Biceps Training', 'Pull', 'Beginner', 'Latzug 3x10, Rudern 3x10, Klimmzüge 3x8, Bizepscurls 3x12', 'Fokus auf Pull-Bewegungen'),
('Leg Day Workout', 'Legs', 'Beginner', 'Kniebeugen 3x10, Beinpresse 3x12, Wadenheben 3x15, Beinbeuger 3x10', 'Komplettes Beintraining'),
('Upper Body Power', 'Upper', 'Intermediate', 'Bankdrücken 4x8, Latzug 4x8, Schulterdrücken 3x10, Rudern 3x10', 'Oberkörper komplett'),
('Full Body Strength', 'Full', 'Intermediate', 'Kniebeugen 3x8, Bankdrücken 3x8, Latzug 3x8, Schulterdrücken 3x8, Kreuzheben 3x5', 'Ganzkörpertraining');

-- Verify the changes
SELECT focus_area, difficulty, COUNT(*) as count 
FROM bodybuilding_workouts 
GROUP BY focus_area, difficulty 
ORDER BY focus_area, difficulty;