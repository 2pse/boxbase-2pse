-- Add bonus_points column to monthly_challenges table
ALTER TABLE public.monthly_challenges 
ADD COLUMN bonus_points integer NOT NULL DEFAULT 0;

-- Add challenge_bonus_points column to leaderboard_entries table to track bonus points separately
ALTER TABLE public.leaderboard_entries 
ADD COLUMN challenge_bonus_points integer NOT NULL DEFAULT 0;

-- Create function to award challenge bonus points
CREATE OR REPLACE FUNCTION public.award_challenge_bonus(user_id_param uuid, challenge_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    challenge_rec RECORD;
    session_year INTEGER;
    session_month INTEGER;
BEGIN
    -- Get challenge details and bonus points
    SELECT * INTO challenge_rec 
    FROM public.monthly_challenges 
    WHERE id = challenge_id_param;
    
    IF FOUND AND challenge_rec.bonus_points > 0 THEN
        session_year := challenge_rec.year;
        session_month := challenge_rec.month;
        
        -- Update leaderboard entry with bonus points
        INSERT INTO public.leaderboard_entries (user_id, year, month, training_count, challenge_bonus_points)
        VALUES (user_id_param, session_year, session_month, 0, challenge_rec.bonus_points)
        ON CONFLICT (user_id, year, month)
        DO UPDATE SET 
            challenge_bonus_points = leaderboard_entries.challenge_bonus_points + challenge_rec.bonus_points,
            updated_at = now();
    END IF;
END;
$$;

-- Create trigger function to automatically award bonus points when challenge is completed
CREATE OR REPLACE FUNCTION public.handle_challenge_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if challenge was just completed (is_completed changed from false to true)
    IF TG_OP = 'UPDATE' AND OLD.is_completed = false AND NEW.is_completed = true THEN
        PERFORM public.award_challenge_bonus(NEW.user_id, NEW.challenge_id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for challenge completion
CREATE TRIGGER trigger_challenge_completion
    AFTER UPDATE ON public.user_challenge_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_challenge_completion();