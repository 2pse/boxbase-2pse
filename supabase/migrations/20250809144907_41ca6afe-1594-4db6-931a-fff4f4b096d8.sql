-- Allow admins and trainers to create course templates
ALTER TABLE public.course_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Create INSERT policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'course_templates' 
      AND policyname = 'Admins and trainers can insert course templates'
  ) THEN
    CREATE POLICY "Admins and trainers can insert course templates"
    ON public.course_templates
    FOR INSERT
    WITH CHECK (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'trainer'::app_role)
    );
  END IF;
END $$;