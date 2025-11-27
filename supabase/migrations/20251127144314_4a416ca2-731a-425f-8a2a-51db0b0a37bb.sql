-- Create shop_product_images table for multiple product images
CREATE TABLE IF NOT EXISTS public.shop_product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.shop_products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shop_product_images ENABLE ROW LEVEL SECURITY;

-- RLS policies - anyone can view
CREATE POLICY "Anyone can view product images"
ON public.shop_product_images FOR SELECT
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage product images"
ON public.shop_product_images FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create index for faster lookups
CREATE INDEX idx_shop_product_images_product_id ON public.shop_product_images(product_id);
CREATE INDEX idx_shop_product_images_sort_order ON public.shop_product_images(product_id, sort_order);