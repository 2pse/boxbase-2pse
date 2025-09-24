-- Phase 1: Extensions und Basis-Setup (korrigiert)

-- 1. EXTENSIONS installieren (falls noch nicht vorhanden)
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. CUSTOM TYPES erweitern - app_role Enum mit neuen Rollen
DO $$ 
BEGIN
    -- Füge neue Rollen zum bestehenden app_role Enum hinzu
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
END $$;

-- 3. Weitere benötigte Enums für das System (nur falls nicht vorhanden)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_status') THEN
        CREATE TYPE public.course_status AS ENUM (
            'active',
            'cancelled',
            'completed'
        );
    END IF;
END $$;

-- 4. Überprüfe und korrigiere die update_updated_at_column Funktion
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;