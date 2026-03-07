-- Migration 85: Create trade_wants table for BGG wishlist sync
-- Stores games users want to acquire, imported from BGG wishlist

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

ALTER TABLE public.trade_wants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trade wants"
    ON public.trade_wants FOR SELECT TO authenticated
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub' = user_id::text);

CREATE POLICY "Users can manage own trade wants"
    ON public.trade_wants FOR ALL TO authenticated
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub'::uuid = user_id);
