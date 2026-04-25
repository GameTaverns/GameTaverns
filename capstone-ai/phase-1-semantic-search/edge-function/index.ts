// supabase/functions/embed-catalog/index.ts
//
// Generates and stores vector embeddings for game_catalog rows.
// Modes:
//   POST { mode: "single", catalog_id: "uuid" }       -> embed one game (used after edits)
//   POST { mode: "backfill", limit: 200 }             -> embed N un-embedded games (cron-friendly)
//   POST { mode: "query", text: "co-op dungeon..." }  -> return an embedding for live search
//
// =============================================================================
// CORTEX ENDPOINT — TODO: WIRE UP
// =============================================================================
// This function expects an OpenAI-compatible /v1/embeddings endpoint exposed by
// your self-hosted Cortex stack. Set these secrets on the live VPS:
//
//   supabase secrets set CORTEX_EMBEDDINGS_URL='http://cortex:8080/v1/embeddings'
//   supabase secrets set CORTEX_EMBEDDINGS_MODEL='qwen-embed-v1'
//   supabase secrets set CORTEX_API_KEY='...'   # if Cortex requires auth
//
// The model MUST output 768-dim vectors to match catalog_embeddings.embedding(768).
// If your model outputs a different size, update the migration's vector(N) AND
// the EMBED_DIM constant below before deploying.
// =============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const EMBED_DIM = 768;
const CORTEX_URL = Deno.env.get("CORTEX_EMBEDDINGS_URL") ?? "";
const CORTEX_MODEL = Deno.env.get("CORTEX_EMBEDDINGS_MODEL") ?? "qwen-embed-v1";
const CORTEX_KEY = Deno.env.get("CORTEX_API_KEY") ?? "";

interface CortexEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!CORTEX_URL) {
    throw new Error("CORTEX_EMBEDDINGS_URL not configured. Set the secret on the VPS and redeploy.");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (CORTEX_KEY) headers["Authorization"] = `Bearer ${CORTEX_KEY}`;

  const resp = await fetch(CORTEX_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: CORTEX_MODEL, input: texts }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Cortex embeddings HTTP ${resp.status}: ${body}`);
  }
  const json = (await resp.json()) as CortexEmbeddingResponse;
  const vecs = json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  for (const v of vecs) {
    if (v.length !== EMBED_DIM) {
      throw new Error(`Embedding dim mismatch: expected ${EMBED_DIM}, got ${v.length}.`);
    }
  }
  return vecs;
}

function buildSourceText(g: {
  title: string;
  description: string | null;
  genres?: string[] | null;
  mechanics?: string[] | null;
}): string {
  const parts: string[] = [g.title];
  if (g.genres?.length) parts.push(`Genres: ${g.genres.join(", ")}`);
  if (g.mechanics?.length) parts.push(`Mechanics: ${g.mechanics.join(", ")}`);
  if (g.description) {
    const cleaned = g.description
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*?/g, "")
      .replace(/\s+/g, " ")
      .trim();
    parts.push(cleaned.slice(0, 4000));
  }
  return parts.join(". ");
}

async function loadCatalogRow(supabase: ReturnType<typeof createClient>, id: string) {
  const { data: game, error } = await supabase
    .from("game_catalog")
    .select("id, title, description")
    .eq("id", id)
    .single();
  if (error || !game) throw new Error(`Catalog row ${id} not found`);

  const [{ data: genres }, { data: mechs }] = await Promise.all([
    supabase.from("catalog_genres").select("genre").eq("catalog_id", id),
    supabase
      .from("catalog_mechanics")
      .select("mechanic_id, mechanics:mechanic_id(name)")
      .eq("catalog_id", id),
  ]);
  return {
    ...game,
    genres: (genres ?? []).map((r: any) => r.genre),
    mechanics: (mechs ?? []).map((r: any) => r.mechanics?.name).filter(Boolean),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? "query";

    // QUERY MODE — embed a search string, return the vector
    if (mode === "query") {
      const text = (body.text ?? "").toString().trim();
      if (!text) {
        return new Response(JSON.stringify({ error: "text required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [vec] = await embedTexts([text.slice(0, 2000)]);
      return new Response(JSON.stringify({ embedding: vec, dim: EMBED_DIM }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SINGLE MODE — re-embed one game (after admin edits)
    if (mode === "single") {
      const id = body.catalog_id;
      if (!id) {
        return new Response(JSON.stringify({ error: "catalog_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const game = await loadCatalogRow(supabase, id);
      const text = buildSourceText(game);
      const [vec] = await embedTexts([text]);
      const { error } = await supabase
        .from("catalog_embeddings")
        .upsert({
          catalog_id: id,
          embedding: vec as unknown as string,
          source_text: text,
          model: CORTEX_MODEL,
        });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, catalog_id: id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BACKFILL MODE — embed N un-embedded games. Designed for pg_cron.
    if (mode === "backfill") {
      const limit = Math.min(Math.max(parseInt(body.limit ?? "50", 10), 1), 200);

      // Find catalog rows lacking embeddings via a left-join filter
      const { data: pending, error: pErr } = await supabase.rpc("catalog_embeddings_pending", {
        p_limit: limit,
      });
      if (pErr) {
        // Fallback if RPC isn't created — use a direct query
        const { data: fallback, error: fErr } = await supabase
          .from("game_catalog")
          .select("id, catalog_embeddings(catalog_id)")
          .eq("is_expansion", false)
          .not("description", "is", null)
          .is("catalog_embeddings.catalog_id", null)
          .limit(limit);
        if (fErr) throw fErr;
        if (!fallback?.length) {
          return new Response(JSON.stringify({ ok: true, processed: 0, message: "all caught up" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return await processBackfill(supabase, fallback.map((r: any) => r.id));
      }
      if (!pending?.length) {
        return new Response(JSON.stringify({ ok: true, processed: 0, message: "all caught up" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return await processBackfill(supabase, pending.map((r: any) => r.id));
    }

    return new Response(JSON.stringify({ error: `unknown mode: ${mode}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("embed-catalog error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function processBackfill(supabase: any, ids: string[]) {
  const games = await Promise.all(ids.map((id) => loadCatalogRow(supabase, id)));
  const texts = games.map(buildSourceText);
  const BATCH = 16;
  let done = 0;
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const vecs = await embedTexts(slice);
    const rows = vecs.map((v, j) => ({
      catalog_id: games[i + j].id,
      embedding: v as unknown as string,
      source_text: slice[j],
      model: CORTEX_MODEL,
    }));
    const { error } = await supabase.from("catalog_embeddings").upsert(rows);
    if (error) throw error;
    done += rows.length;
  }
  return new Response(JSON.stringify({ ok: true, processed: done }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
