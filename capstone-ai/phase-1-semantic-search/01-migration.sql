-- =============================================================================
-- PHASE 1: SEMANTIC SEARCH — DATABASE MIGRATION
-- Target: self-hosted gametaverns-db (Postgres 15+)
-- Run via: docker exec -i gametaverns-db psql -U postgres -d postgres <<'SQL' ... SQL
-- =============================================================================

BEGIN;

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Embeddings table (separate from game_catalog so re-embedding doesn't bloat the main table).
--    Dimension = 768 (works for bge-small, nomic-embed-text, and most Qwen embedding models).
--    If your Cortex embedding model uses a different dimension, change 768 below
--    BEFORE running this migration.
CREATE TABLE IF NOT EXISTS public.catalog_embeddings (
  catalog_id    UUID PRIMARY KEY REFERENCES public.game_catalog(id) ON DELETE CASCADE,
  embedding     vector(768) NOT NULL,
  source_text   TEXT NOT NULL,
  model         TEXT NOT NULL,
  embedded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ANN index (IVFFlat — fast to build, good enough for ~200k rows)
CREATE INDEX IF NOT EXISTS catalog_embeddings_ivfflat
  ON public.catalog_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 400);

-- 4. RLS: read-public, write-service-role-only
ALTER TABLE public.catalog_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embeddings_public_read" ON public.catalog_embeddings;
CREATE POLICY "embeddings_public_read"
  ON public.catalog_embeddings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "embeddings_service_write" ON public.catalog_embeddings;
CREATE POLICY "embeddings_service_write"
  ON public.catalog_embeddings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 5. Search RPC — returns ranked catalog rows by cosine similarity
CREATE OR REPLACE FUNCTION public.search_catalog_semantic(
  query_embedding vector(768),
  match_count     INT DEFAULT 20,
  exclude_expansions BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  id              UUID,
  title           TEXT,
  slug            TEXT,
  image_url       TEXT,
  description     TEXT,
  year_published  INT,
  min_players     INT,
  max_players     INT,
  is_expansion    BOOLEAN,
  similarity      REAL
)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $func$
  SELECT
    g.id, g.title, g.slug, g.image_url, g.description, g.year_published,
    g.min_players, g.max_players, g.is_expansion,
    (1 - (e.embedding <=> query_embedding))::real AS similarity
  FROM public.catalog_embeddings e
  JOIN public.game_catalog g ON g.id = e.catalog_id
  WHERE (NOT exclude_expansions OR g.is_expansion = FALSE)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$func$;

GRANT EXECUTE ON FUNCTION public.search_catalog_semantic(vector, INT, BOOLEAN)
  TO anon, authenticated, service_role;

-- 6. Eval log — capture queries + clicks so we can compute MRR over time
CREATE TABLE IF NOT EXISTS public.search_eval_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query           TEXT NOT NULL,
  search_mode     TEXT NOT NULL CHECK (search_mode IN ('keyword', 'semantic')),
  result_ids      UUID[] NOT NULL,
  clicked_id      UUID,
  clicked_rank    INT,
  user_id         UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_eval_log_created_at_idx
  ON public.search_eval_log(created_at DESC);
CREATE INDEX IF NOT EXISTS search_eval_log_mode_idx
  ON public.search_eval_log(search_mode);

ALTER TABLE public.search_eval_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eval_log_insert_anyone" ON public.search_eval_log;
CREATE POLICY "eval_log_insert_anyone"
  ON public.search_eval_log FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "eval_log_update_own" ON public.search_eval_log;
CREATE POLICY "eval_log_update_own"
  ON public.search_eval_log FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "eval_log_admin_read" ON public.search_eval_log;
CREATE POLICY "eval_log_admin_read"
  ON public.search_eval_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

COMMIT;

-- POST-MIGRATION CHECKS:
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- \d+ public.catalog_embeddings
-- SELECT proname FROM pg_proc WHERE proname = 'search_catalog_semantic';
