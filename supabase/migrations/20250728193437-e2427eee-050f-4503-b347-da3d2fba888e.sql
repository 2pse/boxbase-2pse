-- Update leaderboard entries to be created/updated when training sessions are saved
-- This function will be called whenever a training session is saved
CREATE OR REPLACE FUNCTION update_leaderboard_entry(user_id_param UUID, session_date DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    session_year INTEGER;
    session_month INTEGER;
    current_count INTEGER;
BEGIN
    -- Extract year and month from the session date
    session_year := EXTRACT(YEAR FROM session_date);
    session_month := EXTRACT(MONTH FROM session_date);
    
    -- Count current training sessions for this user, year, and month
    SELECT COUNT(*) INTO current_count
    FROM training_sessions
    WHERE user_id = user_id_param
      AND EXTRACT(YEAR FROM date) = session_year
      AND EXTRACT(MONTH FROM date) = session_month
      AND status = 'completed';
    
    -- Insert or update leaderboard entry
    INSERT INTO leaderboard_entries (user_id, year, month, training_count)
    VALUES (user_id_param, session_year, session_month, current_count)
    ON CONFLICT (user_id, year, month)
    DO UPDATE SET 
        training_count = current_count,
        updated_at = now();
END;
$$;

-- Create trigger to automatically update leaderboard when training sessions are inserted/updated
CREATE OR REPLACE FUNCTION handle_training_session_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Handle INSERT and UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_leaderboard_entry(NEW.user_id, NEW.date);
        RETURN NEW;
    END IF;
    
    -- Handle DELETE (recalculate for old values)
    IF TG_OP = 'DELETE' THEN
        PERFORM update_leaderboard_entry(OLD.user_id, OLD.date);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS training_session_leaderboard_trigger ON training_sessions;
CREATE TRIGGER training_session_leaderboard_trigger
    AFTER INSERT OR UPDATE OR DELETE ON training_sessions
    FOR EACH ROW
    EXECUTE FUNCTION handle_training_session_change();

-- Add unique constraint for user_id, year, month if it doesn't exist
ALTER TABLE leaderboard_entries DROP CONSTRAINT IF EXISTS leaderboard_entries_user_year_month_unique;
ALTER TABLE leaderboard_entries ADD CONSTRAINT leaderboard_entries_user_year_month_unique UNIQUE (user_id, year, month);