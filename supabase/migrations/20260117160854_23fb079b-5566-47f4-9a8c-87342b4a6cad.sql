-- Add location columns to games table
ALTER TABLE public.games 
ADD COLUMN location_room text DEFAULT NULL,
ADD COLUMN location_shelf text DEFAULT NULL;