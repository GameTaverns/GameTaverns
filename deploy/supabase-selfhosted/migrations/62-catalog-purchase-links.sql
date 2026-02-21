-- =============================================================================
-- Catalog Purchase Links
-- Stores retailer/publisher URLs per catalog game
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.catalog_purchase_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id UUID NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
  retailer_name TEXT NOT NULL,
  url TEXT NOT NULL,
  retailer_logo_url TEXT,
  is_affiliate BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'manual',
  submitted_by UUID,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_id, url)
);

CREATE INDEX IF NOT EXISTS idx_catalog_purchase_links_catalog ON public.catalog_purchase_links(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_purchase_links_status ON public.catalog_purchase_links(status);

ALTER TABLE public.catalog_purchase_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved purchase links"
  ON public.catalog_purchase_links FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Admins can manage purchase links"
  ON public.catalog_purchase_links FOR ALL
  USING (public.has_role_level(auth.uid(), 'staff'))
  WITH CHECK (public.has_role_level(auth.uid(), 'staff'));

CREATE POLICY "Users can submit purchase links"
  ON public.catalog_purchase_links FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND submitted_by = auth.uid()
    AND status = 'pending'
  );

CREATE TRIGGER update_catalog_purchase_links_updated_at
  BEFORE UPDATE ON public.catalog_purchase_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON public.catalog_purchase_links TO authenticated, service_role;
GRANT SELECT ON public.catalog_purchase_links TO anon;
