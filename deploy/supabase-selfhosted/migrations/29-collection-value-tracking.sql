-- =============================================================================
-- Collection Value Tracking
-- Version: 2.3.4
-- =============================================================================

-- Extend game_admin_data with value tracking fields
ALTER TABLE public.game_admin_data
  ADD COLUMN IF NOT EXISTS current_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS value_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bgg_market_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS bgg_price_fetched_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN public.game_admin_data.current_value IS 'User-entered current estimated value';
COMMENT ON COLUMN public.game_admin_data.value_updated_at IS 'When the current value was last updated';
COMMENT ON COLUMN public.game_admin_data.bgg_market_price IS 'Average price from BGG marketplace (reference only)';
COMMENT ON COLUMN public.game_admin_data.bgg_price_fetched_at IS 'When BGG price was last fetched';

-- Create index for value queries
CREATE INDEX IF NOT EXISTS idx_game_admin_data_current_value 
  ON public.game_admin_data(current_value) 
  WHERE current_value IS NOT NULL;
