-- Update the app_role enum to include new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'basic_member';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'premium_member';

-- Create table for 10er Karte credit management
CREATE TABLE public.membership_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  credits_total INTEGER NOT NULL DEFAULT 0,
  last_recharged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for Basic Member weekly course limits
CREATE TABLE public.weekly_course_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  registrations_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

-- Enable RLS on new tables
ALTER TABLE public.membership_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_course_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for membership_credits
CREATE POLICY "Users can view their own credits" 
ON public.membership_credits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all credits" 
ON public.membership_credits 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for weekly_course_limits
CREATE POLICY "Users can view their own limits" 
ON public.weekly_course_limits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage course limits" 
ON public.weekly_course_limits 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add triggers for updated_at
CREATE TRIGGER update_membership_credits_updated_at
BEFORE UPDATE ON public.membership_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekly_course_limits_updated_at
BEFORE UPDATE ON public.weekly_course_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update profiles table to use new membership types
UPDATE public.profiles 
SET membership_type = 'Premium Member' 
WHERE membership_type = 'Member';

-- Create function to get user's weekly registration count
CREATE OR REPLACE FUNCTION public.get_weekly_registrations_count(user_id_param UUID, check_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
    week_start DATE;
    reg_count INTEGER;
BEGIN
    -- Calculate start of week (Monday)
    week_start := check_date - EXTRACT(DOW FROM check_date)::INTEGER + 1;
    
    -- Count non-cancelled registrations in the current week
    SELECT COUNT(*) INTO reg_count
    FROM public.course_registrations cr
    JOIN public.courses c ON cr.course_id = c.id
    WHERE cr.user_id = user_id_param
      AND cr.status IN ('registered', 'waitlisted')
      AND c.course_date >= week_start
      AND c.course_date < week_start + INTERVAL '7 days';
    
    RETURN COALESCE(reg_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to check if user can register for course
CREATE OR REPLACE FUNCTION public.can_user_register_for_course(user_id_param UUID, course_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role app_role;
    user_membership_type TEXT;
    weekly_count INTEGER;
    user_credits INTEGER;
    course_date DATE;
BEGIN
    -- Get user role and membership type
    SELECT ur.role, p.membership_type
    INTO user_role, user_membership_type
    FROM public.user_roles ur
    JOIN public.profiles p ON ur.user_id = p.user_id
    WHERE ur.user_id = user_id_param
    LIMIT 1;
    
    -- Get course date
    SELECT c.course_date INTO course_date
    FROM public.courses c
    WHERE c.id = course_id_param;
    
    -- Admin and trainers can always register
    IF user_role IN ('admin', 'trainer') THEN
        RETURN TRUE;
    END IF;
    
    -- Check Basic Member weekly limit
    IF user_membership_type = 'Basic Member' THEN
        weekly_count := get_weekly_registrations_count(user_id_param, course_date);
        IF weekly_count >= 2 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check 10er Karte credits
    IF user_membership_type = '10er Karte' THEN
        SELECT credits_remaining INTO user_credits
        FROM public.membership_credits
        WHERE user_id = user_id_param;
        
        IF COALESCE(user_credits, 0) <= 0 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to handle course registration with limits
CREATE OR REPLACE FUNCTION public.handle_course_registration_with_limits()
RETURNS TRIGGER AS $$
DECLARE
    user_membership_type TEXT;
    week_start DATE;
BEGIN
    -- Only process inserts for new registrations
    IF TG_OP = 'INSERT' AND NEW.status IN ('registered', 'waitlisted') THEN
        -- Get user's membership type
        SELECT membership_type INTO user_membership_type
        FROM public.profiles
        WHERE user_id = NEW.user_id;
        
        -- Handle 10er Karte credit deduction
        IF user_membership_type = '10er Karte' THEN
            UPDATE public.membership_credits
            SET credits_remaining = credits_remaining - 1,
                updated_at = now()
            WHERE user_id = NEW.user_id;
        END IF;
        
        -- Handle Basic Member weekly tracking
        IF user_membership_type = 'Basic Member' THEN
            -- Calculate week start (Monday)
            SELECT course_date - EXTRACT(DOW FROM course_date)::INTEGER + 1
            INTO week_start
            FROM public.courses
            WHERE id = NEW.course_id;
            
            -- Insert or update weekly limit tracking
            INSERT INTO public.weekly_course_limits (user_id, week_start_date, registrations_count)
            VALUES (NEW.user_id, week_start, 1)
            ON CONFLICT (user_id, week_start_date)
            DO UPDATE SET 
                registrations_count = weekly_course_limits.registrations_count + 1,
                updated_at = now();
        END IF;
    END IF;
    
    -- Handle cancellations - restore credits/counts
    IF TG_OP = 'UPDATE' AND OLD.status IN ('registered', 'waitlisted') AND NEW.status = 'cancelled' THEN
        -- Get user's membership type
        SELECT membership_type INTO user_membership_type
        FROM public.profiles
        WHERE user_id = NEW.user_id;
        
        -- Restore 10er Karte credit
        IF user_membership_type = '10er Karte' THEN
            UPDATE public.membership_credits
            SET credits_remaining = credits_remaining + 1,
                updated_at = now()
            WHERE user_id = NEW.user_id;
        END IF;
        
        -- Restore Basic Member weekly count
        IF user_membership_type = 'Basic Member' THEN
            -- Calculate week start (Monday)
            SELECT course_date - EXTRACT(DOW FROM course_date)::INTEGER + 1
            INTO week_start
            FROM public.courses
            WHERE id = NEW.course_id;
            
            -- Decrease weekly count
            UPDATE public.weekly_course_limits
            SET registrations_count = GREATEST(0, registrations_count - 1),
                updated_at = now()
            WHERE user_id = NEW.user_id AND week_start_date = week_start;
        END IF;
    END IF;
    
    -- Call the original waitlist advancement function
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'registered' AND NEW.status = 'cancelled' THEN
            PERFORM advance_waitlist(NEW.course_id);
        END IF;
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'waitlisted' THEN
            PERFORM advance_waitlist(NEW.course_id);
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger and create new one
DROP TRIGGER IF EXISTS course_registration_change_trigger ON public.course_registrations;
CREATE TRIGGER course_registration_change_trigger
AFTER INSERT OR UPDATE ON public.course_registrations
FOR EACH ROW
EXECUTE FUNCTION public.handle_course_registration_with_limits();