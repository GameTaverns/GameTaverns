
-- Extend game_copies with granular tracking fields
ALTER TABLE public.game_copies ADD COLUMN IF NOT EXISTS edition TEXT;
ALTER TABLE public.game_copies ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English';
ALTER TABLE public.game_copies ADD COLUMN IF NOT EXISTS location_room TEXT;
ALTER TABLE public.game_copies ADD COLUMN IF NOT EXISTS location_shelf TEXT;
ALTER TABLE public.game_copies ADD COLUMN IF NOT EXISTS location_misc TEXT;
ALTER TABLE public.game_copies ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE public.game_copies ADD COLUMN IF NOT EXISTS purchase_price NUMERIC;
ALTER TABLE public.game_copies ADD COLUMN IF NOT EXISTS acquisition_source TEXT;

NOTIFY pgrst, 'reload schema';
