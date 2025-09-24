-- Create course templates table
CREATE TABLE public.course_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  trainer TEXT NOT NULL,
  strength_exercise TEXT,
  max_participants INTEGER NOT NULL CHECK (max_participants BETWEEN 10 AND 20),
  registration_deadline_minutes INTEGER NOT NULL DEFAULT 30,
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create courses table (individual course instances)
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.course_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  trainer TEXT NOT NULL,
  strength_exercise TEXT,
  max_participants INTEGER NOT NULL,
  registration_deadline_minutes INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  course_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create course registrations table (includes waitlist)
CREATE TABLE public.course_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'waitlist', 'cancelled')),
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_id, user_id)
);

-- Create news table for "Aktuelles"
CREATE TABLE public.news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.course_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course_templates
CREATE POLICY "Admins can manage course templates" 
ON public.course_templates 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members can view course templates" 
ON public.course_templates 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

-- RLS Policies for courses
CREATE POLICY "Admins can manage courses" 
ON public.courses 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members can view courses" 
ON public.courses 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

-- RLS Policies for course_registrations
CREATE POLICY "Admins can view all registrations" 
ON public.course_registrations 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view registrations for courses they're registered to" 
ON public.course_registrations 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can register for courses" 
ON public.course_registrations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own registrations" 
ON public.course_registrations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all registrations" 
ON public.course_registrations 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for news
CREATE POLICY "Admins can manage news" 
ON public.news 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members can view published news" 
ON public.news 
FOR SELECT 
USING (auth.role() = 'authenticated'::text AND is_published = true);

-- Create triggers for updated_at
CREATE TRIGGER update_course_templates_updated_at
BEFORE UPDATE ON public.course_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_course_registrations_updated_at
BEFORE UPDATE ON public.course_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_news_updated_at
BEFORE UPDATE ON public.news
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle waitlist advancement
CREATE OR REPLACE FUNCTION public.advance_waitlist(course_id_param UUID)
RETURNS VOID AS $$
DECLARE
    available_spots INTEGER;
    max_spots INTEGER;
    registered_count INTEGER;
    waitlist_user UUID;
BEGIN
    -- Get course details
    SELECT max_participants INTO max_spots
    FROM public.courses
    WHERE id = course_id_param;
    
    -- Count current registered participants
    SELECT COUNT(*) INTO registered_count
    FROM public.course_registrations
    WHERE course_id = course_id_param AND status = 'registered';
    
    -- Calculate available spots
    available_spots := max_spots - registered_count;
    
    -- Advance waitlist users if spots are available
    WHILE available_spots > 0 LOOP
        -- Get the oldest waitlist entry
        SELECT user_id INTO waitlist_user
        FROM public.course_registrations
        WHERE course_id = course_id_param AND status = 'waitlist'
        ORDER BY registered_at ASC
        LIMIT 1;
        
        -- Exit if no waitlist users
        EXIT WHEN waitlist_user IS NULL;
        
        -- Promote waitlist user to registered
        UPDATE public.course_registrations
        SET status = 'registered', updated_at = now()
        WHERE course_id = course_id_param AND user_id = waitlist_user;
        
        available_spots := available_spots - 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically advance waitlist when someone cancels
CREATE OR REPLACE FUNCTION public.handle_course_registration_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If someone cancelled their registration, advance waitlist
    IF OLD.status = 'registered' AND NEW.status = 'cancelled' THEN
        PERFORM advance_waitlist(NEW.course_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER course_registration_change_trigger
AFTER UPDATE ON public.course_registrations
FOR EACH ROW
EXECUTE FUNCTION public.handle_course_registration_change();

-- Function to get course registration stats
CREATE OR REPLACE FUNCTION public.get_course_stats(course_id_param UUID)
RETURNS TABLE(
    registered_count BIGINT,
    waitlist_count BIGINT,
    max_participants INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.course_registrations WHERE course_id = course_id_param AND status = 'registered'),
        (SELECT COUNT(*) FROM public.course_registrations WHERE course_id = course_id_param AND status = 'waitlist'),
        (SELECT c.max_participants FROM public.courses c WHERE c.id = course_id_param);
END;
$$ LANGUAGE plpgsql;