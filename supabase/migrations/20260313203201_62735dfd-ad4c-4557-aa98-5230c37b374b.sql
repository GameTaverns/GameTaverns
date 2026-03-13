
-- 1. Catalog genres junction table
CREATE TABLE public.catalog_genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
  genre text NOT NULL,
  UNIQUE(catalog_id, genre)
);

CREATE INDEX idx_catalog_genres_catalog ON public.catalog_genres(catalog_id);
CREATE INDEX idx_catalog_genres_genre ON public.catalog_genres(genre);

ALTER TABLE public.catalog_genres ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can view catalog genres"
  ON public.catalog_genres FOR SELECT
  TO public
  USING (true);

-- Admin write
CREATE POLICY "Admins can manage catalog genres"
  ON public.catalog_genres FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Catalog documents table
CREATE TABLE public.catalog_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'rulebook',
  title text NOT NULL,
  file_path text NOT NULL,
  file_size_bytes bigint,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_documents_catalog ON public.catalog_documents(catalog_id);

ALTER TABLE public.catalog_documents ENABLE ROW LEVEL SECURITY;

-- Public read (approved docs)
CREATE POLICY "Anyone can view approved catalog documents"
  ON public.catalog_documents FOR SELECT
  TO public
  USING (status = 'approved');

-- Admin full access
CREATE POLICY "Admins can manage catalog documents"
  ON public.catalog_documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert (for submissions)
CREATE POLICY "Authenticated users can submit catalog documents"
  ON public.catalog_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- Create storage bucket for catalog documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('catalog-documents', 'catalog-documents', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for catalog-documents bucket
CREATE POLICY "Anyone can read catalog documents storage"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'catalog-documents');

CREATE POLICY "Authenticated users can upload catalog documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'catalog-documents');

CREATE POLICY "Admins can delete catalog documents storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'catalog-documents' AND public.has_role(auth.uid(), 'admin'));
