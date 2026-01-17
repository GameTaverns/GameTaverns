-- Add sleeved and upgraded_components boolean fields to games table
ALTER TABLE public.games ADD COLUMN sleeved boolean DEFAULT false;
ALTER TABLE public.games ADD COLUMN upgraded_components boolean DEFAULT false;