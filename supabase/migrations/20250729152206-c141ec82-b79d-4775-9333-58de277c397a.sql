-- Create table for gym access codes
CREATE TABLE public.gym_access_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.gym_access_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all gym access codes" 
ON public.gym_access_codes 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can insert gym access codes" 
ON public.gym_access_codes 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can update gym access codes" 
ON public.gym_access_codes 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
));

-- Create policy for members to view active gym access codes
CREATE POLICY "Members can view active gym access codes" 
ON public.gym_access_codes 
FOR SELECT 
USING (is_active = true AND EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'member'
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_gym_access_codes_updated_at
BEFORE UPDATE ON public.gym_access_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default gym access code
INSERT INTO public.gym_access_codes (code, description, is_active)
VALUES ('1234', 'Standard Gym Zugangscode', true);