
-- Add market value tracking columns to game_admin_data
ALTER TABLE public.game_admin_data
  ADD COLUMN IF NOT EXISTS current_value NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS value_updated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bgg_market_price NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bgg_price_fetched_at TIMESTAMPTZ DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.game_admin_data.current_value IS 'Current estimated resale/market value, owner-set';
COMMENT ON COLUMN public.game_admin_data.value_updated_at IS 'When current_value was last manually updated';
COMMENT ON COLUMN public.game_admin_data.bgg_market_price IS 'BGG marketplace reference price (auto-fetched)';
COMMENT ON COLUMN public.game_admin_data.bgg_price_fetched_at IS 'When bgg_market_price was last fetched';
