
-- ============================================================
-- 1. Catalog image submissions table (trust-tiered moderation)
-- ============================================================
CREATE TABLE public.catalog_image_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for admin review queue
CREATE INDEX idx_catalog_image_submissions_status ON public.catalog_image_submissions(status, created_at DESC);
CREATE INDEX idx_catalog_image_submissions_user ON public.catalog_image_submissions(submitted_by);

ALTER TABLE public.catalog_image_submissions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view their own submissions
CREATE POLICY "Users can view own image submissions"
  ON public.catalog_image_submissions FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

-- Admins can view all submissions
CREATE POLICY "Admins can view all image submissions"
  ON public.catalog_image_submissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert submissions
CREATE POLICY "Users can submit images"
  ON public.catalog_image_submissions FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Admins can update (approve/reject)
CREATE POLICY "Admins can update image submissions"
  ON public.catalog_image_submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete
CREATE POLICY "Admins can delete image submissions"
  ON public.catalog_image_submissions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2. Trust-tier check function
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_trusted_image_submitter(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*) FROM public.catalog_image_submissions
    WHERE submitted_by = _user_id AND status = 'approved'
  ) >= 3
$$;

-- ============================================================
-- 3. Storage bucket for catalog image submissions
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-image-submissions',
  'catalog-image-submissions',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for catalog-image-submissions
CREATE POLICY "Anyone can read catalog image submissions storage"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'catalog-image-submissions');

CREATE POLICY "Authenticated users can upload catalog image submissions"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'catalog-image-submissions');

CREATE POLICY "Admins can delete catalog image submissions storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'catalog-image-submissions' AND public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 4. Harden existing document buckets with allowed_mime_types
-- ============================================================
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
WHERE id = 'catalog-documents';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
WHERE id = 'game-documents';
