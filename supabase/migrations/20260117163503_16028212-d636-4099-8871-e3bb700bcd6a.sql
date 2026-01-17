-- Add kickstarter_edition column to games table
ALTER TABLE public.games ADD COLUMN kickstarter_edition boolean DEFAULT false;