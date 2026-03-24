
CREATE TABLE public.recommendation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-cleanup old cache entries
CREATE INDEX idx_recommendation_cache_created ON public.recommendation_cache (created_at);
CREATE INDEX idx_recommendation_cache_key ON public.recommendation_cache (cache_key);

-- RLS: only service role accesses this
ALTER TABLE public.recommendation_cache ENABLE ROW LEVEL SECURITY;
