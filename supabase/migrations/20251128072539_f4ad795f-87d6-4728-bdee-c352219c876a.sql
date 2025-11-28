-- Risk Radar Tables

-- 1. Never Active Snapshots Table
CREATE TABLE public.never_active_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  total_never_active INTEGER NOT NULL DEFAULT 0,
  days_0_7_count INTEGER NOT NULL DEFAULT 0,
  days_8_14_count INTEGER NOT NULL DEFAULT 0,
  days_15_21_count INTEGER NOT NULL DEFAULT 0,
  days_21_plus_count INTEGER NOT NULL DEFAULT 0,
  days_0_7_percentage NUMERIC,
  days_8_14_percentage NUMERIC,
  days_15_21_percentage NUMERIC,
  days_21_plus_percentage NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.never_active_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin-only SELECT
CREATE POLICY "Admins can view never_active_snapshots"
  ON public.never_active_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Never Active Member Details Table
CREATE TABLE public.never_active_member_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  days_since_signup INTEGER NOT NULL,
  category TEXT NOT NULL,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  membership_type TEXT,
  signup_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

-- Enable RLS
ALTER TABLE public.never_active_member_details ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin-only SELECT
CREATE POLICY "Admins can view never_active_member_details"
  ON public.never_active_member_details FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Inactive Member Snapshots Table
CREATE TABLE public.inactive_member_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  total_previously_active INTEGER NOT NULL DEFAULT 0,
  active_under_10_count INTEGER NOT NULL DEFAULT 0,
  days_10_15_count INTEGER NOT NULL DEFAULT 0,
  days_15_21_count INTEGER NOT NULL DEFAULT 0,
  days_21_plus_count INTEGER NOT NULL DEFAULT 0,
  active_under_10_percentage NUMERIC,
  days_10_15_percentage NUMERIC,
  days_15_21_percentage NUMERIC,
  days_21_plus_percentage NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inactive_member_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin-only SELECT
CREATE POLICY "Admins can view inactive_member_snapshots"
  ON public.inactive_member_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Inactive Member Details Table
CREATE TABLE public.inactive_member_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  days_since_last_activity INTEGER NOT NULL,
  category TEXT NOT NULL,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  membership_type TEXT,
  last_activity_date DATE,
  total_bookings INTEGER DEFAULT 0,
  total_training_sessions INTEGER DEFAULT 0,
  cancellations INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

-- Enable RLS
ALTER TABLE public.inactive_member_details ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin-only SELECT
CREATE POLICY "Admins can view inactive_member_details"
  ON public.inactive_member_details FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));