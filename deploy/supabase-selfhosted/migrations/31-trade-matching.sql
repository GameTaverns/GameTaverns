-- =============================================================================
-- Cross-Library Trade Matching System
-- Version: 2.3.4
-- =============================================================================

-- Trade listing status
DO $$ BEGIN
    CREATE TYPE trade_listing_status AS ENUM (
        'active',
        'matched',
        'completed',
        'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trade offer status
DO $$ BEGIN
    CREATE TYPE trade_offer_status AS ENUM (
        'pending',
        'accepted',
        'declined',
        'withdrawn',
        'completed'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Games users want to trade away (for-trade list)
CREATE TABLE IF NOT EXISTS public.trade_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    condition sale_condition NOT NULL DEFAULT 'Good',
    notes TEXT,
    willing_to_ship BOOLEAN NOT NULL DEFAULT false,
    local_only BOOLEAN NOT NULL DEFAULT true,
    status trade_listing_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, game_id)
);

-- Games users are looking for (want list)
CREATE TABLE IF NOT EXISTS public.trade_wants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bgg_id TEXT NOT NULL,
    game_title TEXT NOT NULL,
    notes TEXT,
    priority INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, bgg_id)
);

-- Trade offers between users
CREATE TABLE IF NOT EXISTS public.trade_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiving_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    offering_listing_id UUID NOT NULL REFERENCES public.trade_listings(id) ON DELETE CASCADE,
    receiving_listing_id UUID REFERENCES public.trade_listings(id) ON DELETE SET NULL,
    message TEXT,
    status trade_offer_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_wants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trade_listings
CREATE POLICY "Active listings from discoverable libraries are viewable"
ON public.trade_listings FOR SELECT
TO authenticated
USING (
    status = 'active' AND
    EXISTS (
        SELECT 1 FROM public.library_settings ls 
        WHERE ls.library_id = trade_listings.library_id 
        AND ls.is_discoverable = true
    )
);

CREATE POLICY "Users can manage their own listings"
ON public.trade_listings FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for trade_wants
CREATE POLICY "Want lists are public to authenticated users"
ON public.trade_wants FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can manage their own want list"
ON public.trade_wants FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for trade_offers
CREATE POLICY "Users can view offers they're involved in"
ON public.trade_offers FOR SELECT
TO authenticated
USING (auth.uid() = offering_user_id OR auth.uid() = receiving_user_id);

CREATE POLICY "Users can create offers"
ON public.trade_offers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = offering_user_id);

CREATE POLICY "Users can update their received offers"
ON public.trade_offers FOR UPDATE
TO authenticated
USING (auth.uid() = receiving_user_id OR auth.uid() = offering_user_id);

-- Indexes for efficient matching
CREATE INDEX IF NOT EXISTS idx_trade_listings_bgg_id ON public.trade_listings(game_id);
CREATE INDEX IF NOT EXISTS idx_trade_listings_status ON public.trade_listings(status);
CREATE INDEX IF NOT EXISTS idx_trade_listings_user_id ON public.trade_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_wants_bgg_id ON public.trade_wants(bgg_id);
CREATE INDEX IF NOT EXISTS idx_trade_wants_user_id ON public.trade_wants(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status ON public.trade_offers(status);

-- Triggers
CREATE TRIGGER update_trade_listings_updated_at
    BEFORE UPDATE ON public.trade_listings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trade_offers_updated_at
    BEFORE UPDATE ON public.trade_offers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to find trade matches for a user
CREATE OR REPLACE FUNCTION public.find_trade_matches(for_user_id UUID)
RETURNS TABLE (
    want_id UUID,
    want_title TEXT,
    listing_id UUID,
    listing_user_id UUID,
    listing_user_name TEXT,
    listing_condition sale_condition,
    listing_notes TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT 
        tw.id as want_id,
        tw.game_title as want_title,
        tl.id as listing_id,
        tl.user_id as listing_user_id,
        up.display_name as listing_user_name,
        tl.condition as listing_condition,
        tl.notes as listing_notes
    FROM public.trade_wants tw
    JOIN public.games g ON g.bgg_id = tw.bgg_id
    JOIN public.trade_listings tl ON tl.game_id = g.id AND tl.status = 'active'
    JOIN public.user_profiles up ON up.user_id = tl.user_id
    JOIN public.library_settings ls ON ls.library_id = tl.library_id AND ls.is_discoverable = true
    WHERE tw.user_id = for_user_id
    AND tl.user_id != for_user_id
    ORDER BY tw.priority ASC, tl.created_at DESC;
$$;
