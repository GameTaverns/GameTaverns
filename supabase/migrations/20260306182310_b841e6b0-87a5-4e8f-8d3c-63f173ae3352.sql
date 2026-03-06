-- Fix: Change default to true so libraries are visible by default
ALTER TABLE public.club_libraries ALTER COLUMN is_visible SET DEFAULT true;

-- Update all existing rows to be visible
UPDATE public.club_libraries SET is_visible = true WHERE is_visible = false;