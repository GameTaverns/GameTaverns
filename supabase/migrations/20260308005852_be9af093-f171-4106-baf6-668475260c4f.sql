
-- Personal loans table for tracking loans to friends/family outside the platform
CREATE TABLE public.personal_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  borrower_contact TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
  loaned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  condition_out TEXT,
  condition_in TEXT,
  notes TEXT,
  copy_id UUID REFERENCES public.game_copies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_loans ENABLE ROW LEVEL SECURITY;

-- Only library owner or co-owner can manage personal loans
CREATE POLICY "Owner can manage personal loans"
  ON public.personal_loans
  FOR ALL
  TO authenticated
  USING (public.is_library_co_owner(auth.uid(), library_id))
  WITH CHECK (public.is_library_co_owner(auth.uid(), library_id));

-- Index for fast lookups
CREATE INDEX idx_personal_loans_library ON public.personal_loans(library_id);
CREATE INDEX idx_personal_loans_game ON public.personal_loans(game_id);
CREATE INDEX idx_personal_loans_status ON public.personal_loans(library_id, status);
