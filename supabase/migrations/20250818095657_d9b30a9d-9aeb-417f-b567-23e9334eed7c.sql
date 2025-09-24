-- Phase 1: Extensions und Basis-Setup für Fitness-App

-- 1. EXTENSIONS installieren (falls noch nicht vorhanden)
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH VERSION '1.6';
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH VERSION '1.5.11';
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH VERSION '0.14.0';
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH VERSION '1.11';
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH VERSION '1.3';
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH VERSION '0.3.1';
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH VERSION '1.1';
CREATE EXTENSION IF NOT EXISTS "vector" WITH VERSION '0.8.0';

-- 2. CUSTOM TYPES erweitern - app_role Enum mit allen benötigten Rollen
-- Erst prüfen ob Enum existiert, dann erweitern
DO $$ 
BEGIN
    -- Versuche neue Werte zum bestehenden Enum hinzuzufügen
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        -- Füge neue Rollen hinzu, falls sie noch nicht existieren
        BEGIN
            ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'trainer';
        EXCEPTION WHEN duplicate_object THEN
            NULL; -- Ignore if already exists
        END;
        
        BEGIN
            ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'open_gym';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
        
        BEGIN
            ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'basic_member';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
        
        BEGIN
            ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'premium_member';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    ELSE
        -- Erstelle neuen Enum falls er nicht existiert
        CREATE TYPE public.app_role AS ENUM (
            'admin',
            'member', 
            'trainer',
            'open_gym',
            'basic_member',
            'premium_member'
        );
    END IF;
END $$;

-- 3. Weitere benötigte Enums für das System
CREATE TYPE public.registration_status AS ENUM (
    'registered',
    'waitlist',
    'cancelled'
);

CREATE TYPE public.course_status AS ENUM (
    'active',
    'cancelled',
    'completed'
);

CREATE TYPE public.membership_type AS ENUM (
    'limited',
    'unlimited'
);

-- 4. Basis-Funktionen die für das gesamte System benötigt werden

-- Update updated_at Spalte automatisch
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Überprüfe Benutzerrolle (wichtig für RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;