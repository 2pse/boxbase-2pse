-- Phase 2: Kern-Tabellen erweitern und Challenge-System (korrigiert)

-- 1. Profiles Tabelle erweitern mit Kraftwerten und neuen Feldern
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_dialog_shown boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bench_press_1rm numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS back_squat_1rm numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS front_squat_1rm numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deadlift_1rm numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS snatch_1rm numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clean_1rm numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS jerk_1rm numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clean_and_jerk_1rm numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_exercises jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS extra_lifts jsonb DEFAULT '[]'::jsonb;

-- 2. Leaderboard erweitern mit Challenge Bonus Punkten
ALTER TABLE public.leaderboard_entries ADD COLUMN IF NOT EXISTS challenge_bonus_points integer DEFAULT 0;

-- 3. Training Sessions erweitern (ohne den problematischen Constraint)
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS plan_id uuid;
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS workout_data jsonb;
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS feedback text;
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- 4. News Tabelle erweitern
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;

-- 5. Challenge-System Tabellen erstellen
CREATE TABLE IF NOT EXISTS public.monthly_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    checkpoint_count integer DEFAULT 12,
    bonus_points integer DEFAULT 0,
    icon text DEFAULT 'target'::text,
    is_primary boolean DEFAULT false,
    is_recurring boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_challenge_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    completed_checkpoints integer DEFAULT 0,
    is_completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, challenge_id)
);

CREATE TABLE IF NOT EXISTS public.challenge_checkpoints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    checkpoint_number integer NOT NULL,
    checked_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, challenge_id, checkpoint_number)
);

CREATE TABLE IF NOT EXISTS public.user_badges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    earned_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, challenge_id)
);

-- 6. Training Plans Tabelle erstellen
CREATE TABLE IF NOT EXISTS public.training_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL,
    goal text NOT NULL,
    duration_weeks integer NOT NULL,
    current_week integer DEFAULT 1,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 7. Waitlist Promotion Events
CREATE TABLE IF NOT EXISTS public.waitlist_promotion_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id uuid NOT NULL,
    course_id uuid NOT NULL,
    user_id uuid NOT NULL,
    payload jsonb,
    notified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- 8. Courses erweitern mit template_id
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS template_id uuid;

-- 9. RLS für alle neuen Tabellen aktivieren
ALTER TABLE public.monthly_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_promotion_events ENABLE ROW LEVEL SECURITY;