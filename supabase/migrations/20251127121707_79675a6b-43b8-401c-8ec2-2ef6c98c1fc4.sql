-- Phase 1: Database Schema Extension

-- 1.1 Extend membership_plans_v2 with new columns
ALTER TABLE public.membership_plans_v2 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'one_time',
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS upgrade_priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancellation_allowed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cancellation_deadline_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#52a7b4';

-- 1.2 Extend user_memberships_v2 with Stripe columns
ALTER TABLE public.user_memberships_v2
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- 1.3 Extend membership_status enum with new values
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_activation' AND enumtypid = 'membership_status'::regtype) THEN
    ALTER TYPE membership_status ADD VALUE 'pending_activation';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'payment_failed' AND enumtypid = 'membership_status'::regtype) THEN
    ALTER TYPE membership_status ADD VALUE 'payment_failed';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'superseded' AND enumtypid = 'membership_status'::regtype) THEN
    ALTER TYPE membership_status ADD VALUE 'superseded';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'upgraded' AND enumtypid = 'membership_status'::regtype) THEN
    ALTER TYPE membership_status ADD VALUE 'upgraded';
  END IF;
END $$;

-- 1.4 Extend gym_settings with stripe_webhook_endpoint
ALTER TABLE public.gym_settings
ADD COLUMN IF NOT EXISTS stripe_webhook_endpoint TEXT;

-- 1.5 Create shop_products table
CREATE TABLE IF NOT EXISTS public.shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  image_url TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on shop_products
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shop_products
CREATE POLICY "Admins can manage shop products"
ON public.shop_products
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active shop products"
ON public.shop_products
FOR SELECT
USING (is_active = true);

-- 1.6 Create shop_product_images table
CREATE TABLE IF NOT EXISTS public.shop_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on shop_product_images
ALTER TABLE public.shop_product_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shop_product_images
CREATE POLICY "Admins can manage shop product images"
ON public.shop_product_images
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view shop product images"
ON public.shop_product_images
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.shop_products 
  WHERE shop_products.id = shop_product_images.product_id 
  AND shop_products.is_active = true
));

-- 1.7 Create purchase_history table
CREATE TABLE IF NOT EXISTS public.purchase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_session_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on purchase_history
ALTER TABLE public.purchase_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_history
CREATE POLICY "Admins can manage all purchase history"
ON public.purchase_history
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own purchase history"
ON public.purchase_history
FOR SELECT
USING (auth.uid() = user_id);

-- 1.8 Create processed_stripe_events table (idempotency)
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  user_id UUID,
  metadata JSONB,
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on processed_stripe_events
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy for processed_stripe_events (service role only via edge functions)
CREATE POLICY "Admins can view processed stripe events"
ON public.processed_stripe_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at triggers for new tables
CREATE TRIGGER update_shop_products_updated_at
  BEFORE UPDATE ON public.shop_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_history_updated_at
  BEFORE UPDATE ON public.purchase_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();