-- Create storage bucket for shop product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-products', 'shop-products', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Admins can upload shop product images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'shop-products' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update images
CREATE POLICY "Admins can update shop product images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'shop-products' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to delete images
CREATE POLICY "Admins can delete shop product images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'shop-products' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow public to view images
CREATE POLICY "Public can view shop product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'shop-products');