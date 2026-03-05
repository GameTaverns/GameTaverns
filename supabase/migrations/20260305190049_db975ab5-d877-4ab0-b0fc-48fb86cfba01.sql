CREATE TABLE public.archetype_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  snapshot_month TEXT NOT NULL, -- e.g. '2026-03'
  primary_archetype TEXT NOT NULL,
  secondary_archetype TEXT,
  source TEXT NOT NULL DEFAULT 'blended', -- 'shelf', 'play', 'blended'
  confidence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(library_id, snapshot_month, source)
);

ALTER TABLE public.archetype_snapshots ENABLE ROW LEVEL SECURITY;

-- Anyone can read snapshots for libraries they can see
CREATE POLICY "Anyone can read archetype snapshots"
ON public.archetype_snapshots FOR SELECT
TO authenticated
USING (true);

-- Only library owners/co-owners can insert snapshots
CREATE POLICY "Library owners can insert snapshots"
ON public.archetype_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
  OR public.is_library_co_owner(auth.uid(), library_id)
);