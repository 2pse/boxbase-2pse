-- Füge optionale link_url Spalte zur News-Tabelle hinzu
ALTER TABLE public.news 
ADD COLUMN link_url TEXT NULL;