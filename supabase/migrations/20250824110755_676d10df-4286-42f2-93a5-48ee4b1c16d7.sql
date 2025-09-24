-- Create storage bucket for challenge badges
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('challenge-badges', 'challenge-badges', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']);

-- Create storage policies for challenge badges
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

CREATE POLICY "Anyone can view challenge badges" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'challenge-badges');