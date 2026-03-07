
-- Create trade_wants table for BGG wishlist sync
CREATE TABLE IF NOT EXISTS public.trade_wants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    bgg_id TEXT,
    game_title TEXT NOT NULL,
    catalog_id UUID REFERENCES public.game_catalog(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, bgg_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_wants_user ON public.trade_wants(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_wants_bgg_id ON public.trade_wants(bgg_id);

-- RLS
ALTER TABLE public.trade_wants ENABLE ROW LEVEL SECURITY;

-- Users can see their own trade wants
CREATE POLICY "Users can view own trade wants"
    ON public.trade_wants FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can insert their own trade wants
CREATE POLICY "Users can insert own trade wants"
    ON public.trade_wants FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can update their own trade wants
CREATE POLICY "Users can update own trade wants"
    ON public.trade_wants FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Users can delete their own trade wants
CREATE POLICY "Users can delete own trade wants"
    ON public.trade_wants FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Service role bypass for edge functions
CREATE POLICY "Service role full access to trade wants"
    ON public.trade_wants FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
