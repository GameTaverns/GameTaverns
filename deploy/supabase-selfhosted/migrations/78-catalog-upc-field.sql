-- Add UPC field to game_catalog and games tables
-- Allows barcode scanning to match games directly by UPC

ALTER TABLE public.game_catalog ADD COLUMN IF NOT EXISTS upc TEXT;
CREATE INDEX IF NOT EXISTS idx_game_catalog_upc ON public.game_catalog(upc) WHERE upc IS NOT NULL;

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS upc TEXT;
CREATE INDEX IF NOT EXISTS idx_games_upc ON public.games(upc) WHERE upc IS NOT NULL;

NOTIFY pgrst, 'reload schema';
