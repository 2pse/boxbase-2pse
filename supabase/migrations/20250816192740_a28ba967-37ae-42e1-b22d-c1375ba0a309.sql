-- Create storage bucket for challenge badges
INSERT INTO storage.buckets (id, name, public)
VALUES ('challenge-badges', 'challenge-badges', true);

-- Create RLS policies for the challenge badges bucket
CREATE POLICY "Anyone can view challenge badges" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'challenge-badges');

CREATE POLICY "Admins can upload challenge badges" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'challenge-badges' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update challenge badges" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'challenge-badges' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete challenge badges" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'challenge-badges' AND has_role(auth.uid(), 'admin'::app_role));