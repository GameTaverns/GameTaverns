
-- =============================================================================
-- Lending Enhancement: condition tracking, waitlist, lending rules
-- =============================================================================

-- 1) Condition tracking on game_loans
ALTER TABLE public.game_loans ADD COLUMN IF NOT EXISTS condition_out TEXT;
ALTER TABLE public.game_loans ADD COLUMN IF NOT EXISTS condition_in TEXT;
ALTER TABLE public.game_loans ADD COLUMN IF NOT EXISTS damage_reported BOOLEAN NOT NULL DEFAULT false;

-- 2) Lending rules on library_settings
ALTER TABLE public.library_settings ADD COLUMN IF NOT EXISTS max_loans_per_borrower INTEGER DEFAULT NULL;
ALTER TABLE public.library_settings ADD COLUMN IF NOT EXISTS default_loan_duration_days INTEGER DEFAULT NULL;
ALTER TABLE public.library_settings ADD COLUMN IF NOT EXISTS min_borrower_rating NUMERIC DEFAULT NULL;

-- 3) Loan waitlist table
CREATE TABLE IF NOT EXISTS public.loan_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'fulfilled', 'cancelled')),
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, user_id, status)
);

CREATE INDEX IF NOT EXISTS idx_loan_waitlist_game ON public.loan_waitlist(game_id);
CREATE INDEX IF NOT EXISTS idx_loan_waitlist_user ON public.loan_waitlist(user_id);

-- Enable RLS
ALTER TABLE public.loan_waitlist ENABLE ROW LEVEL SECURITY;

-- Users can view their own waitlist entries
CREATE POLICY "Users can view own waitlist entries"
ON public.loan_waitlist FOR SELECT
USING (auth.uid() = user_id);

-- Library owners can view waitlist for their games
CREATE POLICY "Library owners can view game waitlist"
ON public.loan_waitlist FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.libraries l
        WHERE l.id = library_id AND l.owner_id = auth.uid()
    )
);

-- Users can insert their own waitlist entries
CREATE POLICY "Users can join waitlist"
ON public.loan_waitlist FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can cancel their own waitlist entries
CREATE POLICY "Users can cancel own waitlist"
ON public.loan_waitlist FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own waitlist entries
CREATE POLICY "Users can delete own waitlist"
ON public.loan_waitlist FOR DELETE
USING (auth.uid() = user_id);

-- Library owners can manage waitlist for their games
CREATE POLICY "Library owners can manage waitlist"
ON public.loan_waitlist FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.libraries l
        WHERE l.id = library_id AND l.owner_id = auth.uid()
    )
);
