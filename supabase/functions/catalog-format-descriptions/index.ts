import { createClient } from "npm:@supabase/supabase-js@2";
import { aiComplete, isAIConfigured, getAIProviderName } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORMAT_SYSTEM_PROMPT = `You are a board game description editor. Rewrite game descriptions into this markdown format:

Opening paragraph: 2-3 sentences about the theme and what makes it unique.

## Quick Gameplay Overview

- **Goal:** One sentence about how to win
- **On Your Turn:** (or **Each Round:**)
  - action 1
  - action 2
  - action 3
- **End Game:** One sentence (optional)
- **Winner:** One sentence about scoring/victory

Optional closing sentence about edition or components.

RULES:
- 150-250 words per game
- If the input is too short or just notes, write a new description based on the game title
- Use proper markdown: ## headers, **bold** labels, - bullet points
- Be factual, not promotional
- You MUST return a JSON array. No other text, no code fences, no explanation.

Return ONLY this JSON structure:
[
  { "title": "<exact title as given>", "description": "<formatted markdown description>" },
  ...one object per game...
]`;

/** Strip control characters that break JSON serialization */
function sanitizeText(text: string): string {
  // Remove ASCII control characters (0x00–0x1F) except tab/newline/CR, then collapse excess whitespace
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/\s{3,}/g, "  ")
    .trim();
}

/** Build the batched prompt for N games */
function buildBatchPrompt(entries: { title: string; description: string | null }[]): string {
  const games = entries.map((e) => ({
    title: sanitizeText(e.title),
    description: e.description ? sanitizeText(e.description.substring(0, 2000)) : null,
  }));
  return JSON.stringify(games, null, 2);
}

/** Sanitize a description string so it can be safely embedded in JSON */
function sanitizeForJson(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    // Escape unescaped backslashes (must be first)
    .replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
    // Replace literal (unescaped) newlines/tabs with their escape sequences
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .trim();
}

/** Normalize a title for fuzzy comparison */
function normalizeTitle(t: string): string {
  return t.toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

/** Attempt to extract individual JSON objects from a broken array string */
function extractObjectsFromBrokenJson(raw: string, entries: { title: string }[]): Map<string, string> {
  const results = new Map<string, string>();
  const objectPattern = /\{\s*"title"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"description"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  let match;
  while ((match = objectPattern.exec(raw)) !== null) {
    const aiNorm = normalizeTitle(match[1]);
    const description = match[2].replace(/\\n/g, "\n").replace(/\\t/g, "\t").trim();
    if (!description) continue;

    let matched = entries.find(e => normalizeTitle(e.title) === aiNorm);
    if (!matched) {
      matched = entries.find(e => {
        const eNorm = normalizeTitle(e.title);
        return aiNorm.includes(eNorm.substring(0, 30)) || eNorm.includes(aiNorm.substring(0, 30));
      });
    }
    if (matched && !results.has(matched.title)) {
      results.set(matched.title, description);
    }
  }
  return results;
}

/** Parse the AI JSON response back into individual game descriptions */
function parseBatchResponse(raw: string, entries: { title: string }[]): Map<string, string> {
  const results = new Map<string, string>();

  // Strip control characters from raw AI output before parsing
  let cleaned = raw.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json|markdown)?\n?/, "").replace(/\n?```$/, "").trim();
  }

  // Find the JSON array (may have preamble text from Perplexity)
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart === -1) {
    console.error("[catalog-format] No JSON array found in response. Raw snippet:", cleaned.substring(0, 200));
    return results;
  }

  // Truncated response: no closing bracket — fall back to object-level regex extraction immediately
  if (arrayEnd === -1 || arrayEnd <= arrayStart) {
    console.warn("[catalog-format] Truncated response detected (no closing ']'). Attempting object-level extraction...");
    const recovered = extractObjectsFromBrokenJson(cleaned.substring(arrayStart), entries);
    console.log(`[catalog-format] Recovered ${recovered.size} entries from truncated response`);
    return recovered;
  }

  const arrayStr = cleaned.substring(arrayStart, arrayEnd + 1);

  let parsed: { title: string; description: string }[];
  try {
    parsed = JSON.parse(arrayStr);
  } catch (e) {
    console.error("[catalog-format] JSON parse error:", e instanceof Error ? e.message : String(e));
    console.warn("[catalog-format] Attempting object-level extraction from broken JSON...");

    // Fallback: extract individual objects with regex (handles one bad entry breaking the whole batch)
    const recovered = extractObjectsFromBrokenJson(arrayStr, entries);
    console.log(`[catalog-format] Recovered ${recovered.size} entries via fallback extraction`);
    return recovered;
  }

  if (!Array.isArray(parsed)) {
    console.error("[catalog-format] Parsed value is not an array");
    return results;
  }


  for (const item of parsed) {
    if (!item?.title || !item?.description) continue;

    const aiTitle = String(item.title).trim();
    const description = String(item.description).trim();
    if (!description) continue;

    const aiNorm = normalizeTitle(aiTitle);

    // 1. Exact normalized match
    let matched = entries.find(e => normalizeTitle(e.title) === aiNorm);

    // 2. Partial match: first 30 chars of normalized title
    if (!matched) {
      const aiPrefix = aiNorm.substring(0, 30);
      matched = entries.find(e => {
        const eNorm = normalizeTitle(e.title);
        return aiNorm.includes(eNorm.substring(0, 30)) ||
               eNorm.includes(aiPrefix);
      });
    }

    if (matched && !results.has(matched.title)) {
      results.set(matched.title, description);
    }
  }

  return results;
}

/** Max items per single AI call — keeps response within Perplexity sonar token limits */
const AI_CALL_CHUNK_SIZE = 20;

/** Process a single chunk of games through AI (max AI_CALL_CHUNK_SIZE items) */
async function processAiChunk(
  chunk: { id: string; title: string; description: string | null }[],
): Promise<Map<string, string>> {
  const batchPrompt = buildBatchPrompt(chunk);

  const aiResult = await aiComplete({
    messages: [
      { role: "system", content: FORMAT_SYSTEM_PROMPT },
      { role: "user", content: `Rewrite the following ${chunk.length} board game descriptions and return a JSON array. Each element must have "title" (exact match) and "description" (formatted markdown):\n\n${batchPrompt}` },
    ],
    max_tokens: chunk.length * 600, // ~600 tokens per game (description + JSON overhead)
  });

  if (!aiResult.success || !aiResult.content) {
    console.error(`[catalog-format] AI chunk error:`, aiResult.error || "empty response");
    return new Map();
  }

  return parseBatchResponse(aiResult.content, chunk);
}

/** Process a single batch of games through AI (splits into sub-chunks to avoid token limits) */
async function processBatch(
  entries: { id: string; title: string; description: string | null }[],
  admin: ReturnType<typeof createClient>,
  dryRun: boolean,
): Promise<{ updated: number; errors: string[]; results: { title: string; status: string }[] }> {
  let updatedCount = 0;
  const errors: string[] = [];
  const results: { title: string; status: string }[] = [];

  try {
    // Split batch into sub-chunks to keep AI response within token limits
    const chunks: typeof entries[] = [];
    for (let i = 0; i < entries.length; i += AI_CALL_CHUNK_SIZE) {
      chunks.push(entries.slice(i, i + AI_CALL_CHUNK_SIZE));
    }

    // Process sub-chunks sequentially within a batch to avoid rate limits
    const parsed = new Map<string, string>();
    for (const chunk of chunks) {
      const chunkResult = await processAiChunk(chunk);
      for (const [title, desc] of chunkResult) {
        parsed.set(title, desc);
      }
    }

    for (const entry of entries) {
      const newDescription = parsed.get(entry.title);

      if (!newDescription) {
        errors.push(`No parsed output for ${entry.title}`);
        results.push({ title: entry.title, status: "parse_miss" });
        continue;
      }

      // Detect AI refusal messages (e.g. "Cannot rewrite: This is a video game")
      const REFUSAL_PATTERNS = [
        /cannot rewrite/i,
        /not a board game/i,
        /this is a video game/i,
        /unable to rewrite/i,
        /not applicable/i,
        /i cannot write/i,
        /i can't write/i,
      ];
      if (REFUSAL_PATTERNS.some(p => p.test(newDescription))) {
        console.warn(`[catalog-format] AI refused to rewrite "${entry.title}": ${newDescription.substring(0, 100)}`);
        errors.push(`AI refusal for ${entry.title}`);

        if (!dryRun) {
          // Write a sentinel so this entry is excluded from future runs (contains format marker)
          const SENTINEL = `*This entry does not appear to be a board game and was excluded from automatic formatting.*\n\n## Quick Gameplay Overview\n\n- **Note:** Not a board game.`;
          await admin.from("game_catalog").update({ description: SENTINEL }).eq("id", entry.id);
        }

        results.push({ title: entry.title, status: "ai_refusal" });
        continue;
      }

      if (!newDescription.includes("Quick Gameplay Overview")) {
        console.warn(`[catalog-format] Output missing format header for ${entry.title}, using anyway`);
      }

      if (dryRun) {
        results.push({ title: entry.title, status: "dry_run" });
        updatedCount++;
        continue;
      }

      const { error: updateErr } = await admin
        .from("game_catalog")
        .update({ description: newDescription })
        .eq("id", entry.id);

      if (updateErr) {
        errors.push(`Update failed for ${entry.title}: ${updateErr.message}`);
        results.push({ title: entry.title, status: "update_error" });
        continue;
      }

      updatedCount++;
      results.push({ title: entry.title, status: "updated" });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Batch error: ${msg}`);
    entries.forEach(e => {
      if (!results.find(r => r.title === e.title)) {
        results.push({ title: e.title, status: "error" });
      }
    });
  }

  // Log status breakdown for debugging
  const statusBreakdown = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[catalog-format] Batch result breakdown:`, JSON.stringify(statusBreakdown));
  if (errors.length > 0) {
    console.error(`[catalog-format] Batch errors:`, errors.slice(0, 5).join(" | "));
  }

  return { updated: updatedCount, errors, results };
}

/**
 * Catalog Format Descriptions — Batched AI formatter for game_catalog entries
 *
 * Finds catalog entries whose descriptions lack the "Quick Gameplay Overview"
 * format and rewrites them using AI in batches of 50 with 3 concurrent workers.
 *
 * Actions:
 * - POST { action: "status" }: return counts of formatted vs unformatted
 * - POST { batchSize: N, workers: N, dryRun: boolean }: control behavior
 *   - batchSize: items per AI call (default 50, max 75)
 *   - workers: concurrent AI calls (default 3, max 5)
 *   - totalLimit: max items to process per invocation (default 150)
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing env config" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: accept service_role key OR admin user JWT
  // Self-hosted cron sends service_role key via Kong; admin UI sends user JWT
  const authHeader = req.headers.get("Authorization") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  let isAuthorized = serviceKey && authHeader.includes(serviceKey);

  if (!isAuthorized && authHeader.startsWith("Bearer ")) {
    if (anonKey) {
      const adminForAuth = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const token = authHeader.slice(7);
      const { data: { user } } = await adminForAuth.auth.getUser(token);
      if (user) {
        const { data: roleData } = await adminForAuth
          .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (roleData) isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const action = body.action || "format";

  // =========================================================================
  // STATUS — Show formatting progress
  // =========================================================================
  if (action === "status") {
    const { count: totalCount } = await admin
      .from("game_catalog").select("id", { count: "exact", head: true });

    const { count: totalWithDesc } = await admin
      .from("game_catalog").select("id", { count: "exact", head: true })
      .not("description", "is", null)
      .neq("description", "");

    const { count: formattedCount } = await admin
      .from("game_catalog").select("id", { count: "exact", head: true })
      .not("description", "is", null)
      .like("description", "%Quick Gameplay Overview%");

    const { count: unformattedCount } = await admin
      .from("game_catalog").select("id", { count: "exact", head: true })
      .not("description", "is", null)
      .neq("description", "")
      .not("description", "like", "%Quick Gameplay Overview%");

    const { count: noDescCount } = await admin
      .from("game_catalog").select("id", { count: "exact", head: true })
      .or("description.is.null,description.eq.");

    return new Response(JSON.stringify({
      total_catalog: totalCount,
      total_with_description: totalWithDesc,
      formatted: formattedCount,
      unformatted: unformattedCount,
      no_description: noDescCount,
      ai_configured: isAIConfigured(),
      ai_provider: isAIConfigured() ? getAIProviderName() : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // =========================================================================
  // FORMAT — Main batch processing with concurrency
  // =========================================================================
  if (!isAIConfigured()) {
    return new Response(JSON.stringify({ error: "AI service not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const batchSize = Math.min(Math.max(body.batchSize || 50, 1), 75);
  const workers = Math.min(Math.max(body.workers || 3, 1), 5);
  const totalLimit = Math.min(body.totalLimit || batchSize * workers, 500);
  const dryRun = body.dryRun === true;

  // Fetch candidates: games that DON'T already have the correct format.
  // NOTE: PostgREST's .or() does not reliably support `not.like` with % wildcards.
  // Instead: fetch games with a description that does NOT contain the format marker,
  // using .not("description", "like", "%Quick Gameplay Overview%") chained separately,
  // then union with null/empty via two queries.
  const [noDescResult, unformattedResult] = await Promise.all([
    // Games with NULL or empty description
    admin
      .from("game_catalog")
      .select("id, title, description, bgg_id")
      .or("description.is.null,description.eq.")
      .order("created_at", { ascending: true })
      .limit(totalLimit),
    // Games with a description but missing the format marker
    admin
      .from("game_catalog")
      .select("id, title, description, bgg_id")
      .not("description", "is", null)
      .neq("description", "")
      .not("description", "like", "%Quick Gameplay Overview%")
      .order("created_at", { ascending: true })
      .limit(totalLimit),
  ]);

  if (noDescResult.error || unformattedResult.error) {
    return new Response(JSON.stringify({ error: "Failed to fetch entries", details: (noDescResult.error || unformattedResult.error)?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Merge, deduplicate by id, cap at totalLimit
  const seen = new Set<string>();
  const allCandidates = [...(noDescResult.data || []), ...(unformattedResult.data || [])].filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  const { data: entries, error: fetchErr } = { data: allCandidates.slice(0, totalLimit), error: null };

  if (fetchErr) {
    return new Response(JSON.stringify({ error: "Failed to fetch entries", details: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const candidates = entries || [];

  if (candidates.length === 0) {
    console.log("[catalog-format] No unformatted catalog descriptions found");
    return new Response(JSON.stringify({
      success: true, message: "No unformatted catalog descriptions found", updated: 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Split candidates into batches
  const batches: typeof candidates[] = [];
  for (let i = 0; i < candidates.length; i += batchSize) {
    batches.push(candidates.slice(i, i + batchSize));
  }

  console.log(`[catalog-format] Processing ${candidates.length} entries in ${batches.length} batches (${batchSize}/batch, ${workers} workers) using ${getAIProviderName()}`);

  // Process batches with N concurrent workers
  let totalUpdated = 0;
  const allErrors: string[] = [];
  const allResults: { title: string; status: string }[] = [];

  // Process in waves of `workers` concurrent batches
  for (let wave = 0; wave < batches.length; wave += workers) {
    const waveBatches = batches.slice(wave, wave + workers);
    const wavePromises = waveBatches.map(batch => processBatch(batch, admin, dryRun));

    const waveResults = await Promise.allSettled(wavePromises);

    for (const result of waveResults) {
      if (result.status === "fulfilled") {
        totalUpdated += result.value.updated;
        allErrors.push(...result.value.errors);
        allResults.push(...result.value.results);

        // Stop all processing if we hit a rate limit
        if (result.value.errors.some(e => e.includes("Rate limited"))) {
          console.warn("[catalog-format] Rate limited — stopping early");
          const response = {
            success: true,
            updated: totalUpdated,
            processed: allResults.length,
            batches_completed: wave + waveBatches.length,
            batches_total: batches.length,
            batch_size: batchSize,
            workers,
            dryRun,
            rate_limited: true,
            results: allResults,
            errors: allErrors.length > 0 ? allErrors : undefined,
          };
          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        allErrors.push(`Wave error: ${result.reason}`);
      }
    }

    // Small delay between waves to avoid rate limits
    if (wave + workers < batches.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const result = {
    success: true,
    updated: totalUpdated,
    processed: candidates.length,
    batches_completed: batches.length,
    batches_total: batches.length,
    batch_size: batchSize,
    workers,
    dryRun,
    results: allResults,
    errors: allErrors.length > 0 ? allErrors : undefined,
  };

  const totalBreakdown = allResults.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[catalog-format] Done:`, JSON.stringify({
    updated: totalUpdated,
    processed: candidates.length,
    batches: batches.length,
    breakdown: totalBreakdown,
    errors: allErrors.length > 0 ? allErrors.slice(0, 3) : undefined,
  }));

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

if (import.meta.main) {
  Deno.serve(handler);
}
