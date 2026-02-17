import { createClient } from "npm:@supabase/supabase-js@2";
import { aiComplete, isAIConfigured, getAIProviderName } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORMAT_SYSTEM_PROMPT = `You are a board game description editor. You will receive MULTIPLE game descriptions separated by "---GAME---" markers. For EACH game, rewrite its description into this EXACT format:

1. Opening paragraph: 2-3 sentences about the game's theme and what makes it special/unique.
2. "## Quick Gameplay Overview" header
3. Bullet points with bold labels:
   - **Goal:** One sentence about how to win
   - **On Your Turn:** or **Each Round:** 3-5 bullet points describing the main actions (use - for sub-bullets)
   - **End Game:** One sentence (optional if obvious from Goal)
   - **Winner:** One sentence about scoring/victory
4. One optional closing sentence about the edition or components if relevant.

CRITICAL RULES:
- Total length per game: 150-250 words
- If the input is just personal notes or too short to describe gameplay, write a NEW description based on the game title
- Use proper markdown: ## for headers, **bold** for labels, - for bullet points
- Be factual and informative, not promotional
- Separate each game's output with "===GAME===" on its own line
- The FIRST line of each game output MUST be "TITLE: <exact game title>"
- Do NOT include any markdown code fences or JSON wrapping`;

/** Authorize the request — service_role key OR admin JWT */
async function authorize(req: Request, supabaseUrl: string, serviceKey: string): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.includes(serviceKey)) return true;

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!anonKey || !authHeader) return false;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return false;

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: roleData } = await adminClient
    .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  return !!roleData;
}

/** Build the batched prompt for N games */
function buildBatchPrompt(entries: { title: string; description: string | null }[]): string {
  return entries.map((e) =>
    `---GAME---\nTitle: ${e.title}\nDescription:\n${e.description ? e.description.substring(0, 2000) : "(No description available — please research and write one)"}`
  ).join("\n\n");
}

/** Parse the AI response back into individual game descriptions */
function parseBatchResponse(raw: string, entries: { title: string }[]): Map<string, string> {
  const results = new Map<string, string>();

  // Strip code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:markdown)?\n?/, "").replace(/\n?```$/, "").trim();
  }

  // Split by the separator
  const parts = cleaned.split(/===GAME===/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Extract title from "TITLE: ..." line
    const titleMatch = trimmed.match(/^TITLE:\s*(.+)/i);
    if (!titleMatch) continue;

    const aiTitle = titleMatch[1].trim();
    const description = trimmed.replace(/^TITLE:\s*.+\n?/, "").trim();

    if (!description) continue;

    // Match to our entries (fuzzy — case-insensitive, trim)
    const matched = entries.find(e =>
      e.title.toLowerCase().trim() === aiTitle.toLowerCase().trim()
    );

    if (matched) {
      results.set(matched.title, description);
    } else {
      // Try partial match as fallback
      const partial = entries.find(e =>
        aiTitle.toLowerCase().includes(e.title.toLowerCase().substring(0, 20))
      );
      if (partial && !results.has(partial.title)) {
        results.set(partial.title, description);
      }
    }
  }

  return results;
}

/** Process a single batch of games through AI */
async function processBatch(
  entries: { id: string; title: string; description: string | null }[],
  admin: ReturnType<typeof createClient>,
  dryRun: boolean,
): Promise<{ updated: number; errors: string[]; results: { title: string; status: string }[] }> {
  const updated = 0;
  const errors: string[] = [];
  const results: { title: string; status: string }[] = [];
  let successCount = 0;

  try {
    const batchPrompt = buildBatchPrompt(entries);

    const aiResult = await aiComplete({
      messages: [
        { role: "system", content: FORMAT_SYSTEM_PROMPT },
        { role: "user", content: `Rewrite the following ${entries.length} board game descriptions:\n\n${batchPrompt}` },
      ],
      max_tokens: entries.length * 400, // ~400 tokens per game
    });

    if (!aiResult.success) {
      console.error(`[catalog-format] AI batch error:`, aiResult.error);
      if (aiResult.rateLimited) {
        errors.push("Rate limited");
        entries.forEach(e => results.push({ title: e.title, status: "rate_limited" }));
        return { updated: 0, errors, results };
      }
      errors.push(`AI batch failed: ${aiResult.error}`);
      entries.forEach(e => results.push({ title: e.title, status: "ai_error" }));
      return { updated: 0, errors, results };
    }

    if (!aiResult.content) {
      errors.push("Empty AI batch response");
      entries.forEach(e => results.push({ title: e.title, status: "empty_response" }));
      return { updated: 0, errors, results };
    }

    const parsed = parseBatchResponse(aiResult.content, entries);

    for (const entry of entries) {
      const newDescription = parsed.get(entry.title);

      if (!newDescription) {
        errors.push(`No parsed output for ${entry.title}`);
        results.push({ title: entry.title, status: "parse_miss" });
        continue;
      }

      if (!newDescription.includes("Quick Gameplay Overview")) {
        console.warn(`[catalog-format] Output missing format header for ${entry.title}, using anyway`);
      }

      if (dryRun) {
        results.push({ title: entry.title, status: "dry_run" });
        successCount++;
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

      successCount++;
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

  return { updated: successCount, errors, results };
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

  if (!await authorize(req, supabaseUrl, serviceKey)) {
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

  // Fetch candidates: games that DON'T already have the correct format
  // This includes games with no description, empty description, or unformatted description
  const { data: entries, error: fetchErr } = await admin
    .from("game_catalog")
    .select("id, title, description, bgg_id")
    .or("description.is.null,description.eq.,description.not.like.%Quick Gameplay Overview%")
    .order("created_at", { ascending: true })
    .limit(totalLimit);

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

  console.log(`[catalog-format] Done:`, JSON.stringify({
    updated: totalUpdated,
    processed: candidates.length,
    batches: batches.length,
  }));

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

if (import.meta.main) {
  Deno.serve(handler);
}
