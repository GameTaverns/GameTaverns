-- Add is_favorite column to games table for library owners to mark featured games
ALTER TABLE public.games ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;