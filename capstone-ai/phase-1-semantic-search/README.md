# Phase 1 — Semantic Catalog Search

Adds embedding-based search to GameTaverns alongside the existing keyword search.
Users can flip a "Smart search" toggle to ask questions in natural language
(e.g. *"co-op dungeon crawler with light rules"*) and get ranked matches even when
no keyword overlaps.

## What you get

- **`catalog_embeddings`** table (pgvector, 768-dim, IVFFlat ANN index)
- **`embed-catalog`** edge function — handles query/single/backfill modes against your Cortex stack
- **`search_catalog_semantic()`** RPC — cosine similarity ranking
- **`useSemanticCatalogSearch`** React hook — drop-in for `CatalogBrowse`
- **`search_eval_log`** table + **MRR eval SQL** — capstone evidence

## Capstone evidence this produces

| Capstone deliverable | Where it lives |
|---|---|
| Retrieval evaluation (MRR, CTR by mode) | `04-eval-mrr.sql` — run any time |
| AI-disclosure UX | "AI ranked" badge above semantic results |
| Bias-aware retrieval baseline | `search_eval_log` joined with publisher tier later (Phase 4) |
| Provider-agnostic embedding contract | `embed-catalog` only depends on OpenAI-compatible `/v1/embeddings` |

## Deployment order (paste into your VPS terminal)

### 1. Apply DB migration

```bash
docker exec -i gametaverns-db psql -U postgres -d postgres < 01-migration.sql
docker exec -i gametaverns-db psql -U postgres -d postgres < 02-pending-rpc.sql
```

Verify:
```bash
docker exec -i gametaverns-db psql -U postgres -d postgres -c \
  "SELECT extname FROM pg_extension WHERE extname='vector';
   \d+ public.catalog_embeddings"
```

### 2. Deploy the edge function

Copy `edge-function/index.ts` to `supabase/functions/embed-catalog/index.ts` in your repo, then per
mem://deployment/self-hosted-function-registration register it in BOTH:
- `supabase/config.toml` (add a `[functions.embed-catalog]` block if you need non-default settings)
- The functions container's import map (whatever your `update.sh` mirrors)

Then deploy:
```bash
./update.sh
```

### 3. Configure Cortex secrets

```bash
docker exec -it gametaverns-functions sh -c '
  echo "CORTEX_EMBEDDINGS_URL=http://cortex:8080/v1/embeddings" >> /home/deno/functions/.env
  echo "CORTEX_EMBEDDINGS_MODEL=qwen-embed-v1"                  >> /home/deno/functions/.env
'
docker restart gametaverns-functions
```

(Replace URL and model with whatever your Cortex actually exposes.
If your model isn't 768-dim, change `vector(768)` in `01-migration.sql` AND `EMBED_DIM` in the edge function FIRST.)

### 4. Smoke-test the edge function

```bash
curl -sX POST http://localhost:9000/embed-catalog \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"query","text":"cooperative dungeon crawler"}' \
  | head -c 200
```

You should see a JSON object with an `embedding` array of 768 floats.

### 5. Start the backfill

Edit `03-cron-backfill.sql` to inject your real `SERVICE_ROLE_KEY`, then:

```bash
docker exec -i gametaverns-db psql -U postgres -d postgres < 03-cron-backfill.sql
```

Watch progress:
```bash
docker exec -i gametaverns-db psql -U postgres -d postgres -c "
  SELECT
    (SELECT COUNT(*) FROM game_catalog WHERE is_expansion=false AND description IS NOT NULL) AS eligible,
    (SELECT COUNT(*) FROM catalog_embeddings) AS embedded;
"
```

At ~16 games per batch, 200 games per cron tick, ~5 min interval, expect ~2,400 games/hour.
A 161k catalog will fully embed in roughly 2.5–3 days — but the search becomes useful as soon
as a few thousand games are done.

### 6. Wire up the frontend

- Drop `frontend/useSemanticCatalogSearch.ts` into `src/hooks/`.
- Apply the patch in `frontend/CatalogBrowse.patch.md` to `src/pages/CatalogBrowse.tsx`.
- Commit, push to `main`, and `./update.sh` will redeploy.

### 7. Capture evidence for the capstone

After a week or so of real usage:
```bash
docker exec -i gametaverns-db psql -U postgres -d postgres < 04-eval-mrr.sql
```

Screenshot the output. That's your retrieval-quality artifact.

## Rollback

```sql
SELECT cron.unschedule('catalog-embeddings-backfill');
DROP FUNCTION IF EXISTS public.search_catalog_semantic(vector, INT, BOOLEAN);
DROP FUNCTION IF EXISTS public.catalog_embeddings_pending(INT);
DROP TABLE IF EXISTS public.catalog_embeddings;
DROP TABLE IF EXISTS public.search_eval_log;
-- pgvector extension can stay; it's harmless idle.
```
