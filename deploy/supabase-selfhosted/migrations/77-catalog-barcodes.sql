-- Barcode-to-game mapping table (learn-as-you-go scanning)
-- Staff scans a game's UPC/EAN barcode; first scan links it, future scans are instant lookup.

CREATE TABLE IF NOT EXISTS public.catalog_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  barcode_type text NOT NULL DEFAULT 'UPC',
  catalog_id uuid REFERENCES public.game_catalog(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_barcodes_barcode_unique UNIQUE (barcode),
  CONSTRAINT catalog_barcodes_has_target CHECK (catalog_id IS NOT NULL OR game_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_catalog_barcodes_barcode ON public.catalog_barcodes (barcode);
CREATE INDEX IF NOT EXISTS idx_catalog_barcodes_catalog_id ON public.catalog_barcodes (catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_barcodes_game_id ON public.catalog_barcodes (game_id);

ALTER TABLE public.catalog_barcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read barcodes"
  ON public.catalog_barcodes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert barcodes"
  ON public.catalog_barcodes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin can delete barcodes"
  ON public.catalog_barcodes FOR DELETE
  TO authenticated USING (
    created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

GRANT ALL ON public.catalog_barcodes TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
