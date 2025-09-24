-- Add payment_frequency column to membership_plans_v2 table
ALTER TABLE public.membership_plans_v2 
ADD COLUMN payment_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly', 'one_time'));