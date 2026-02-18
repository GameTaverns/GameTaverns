import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ALLOWED_TYPES = new Set(["boardgame", "boardgameexpansion"]);
const BATCH_SIZE = 20; // BGG multi-ID limit per request

/**
 * Extract the item type from a BGG XML response for a single or multi-item block.
 * Returns a map of bgg_id -> type string.
 */
function parseTypes(xml: string): Map<string, string> {
  const result = new Map<string, string>();
  const itemRegex = /<item\s+type="([^"]*)"[^>]*id="(\d+)"/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    result.set(m[2], m[1]);
  }
  return result;
}

/**
 * Catalog Cleanup — verifies catalog entries against BGG and removes non-boardgame entries.
 *
 * Actions (POST body):
 *   { action: "status" }          — count of candidates + already-cleaned
 *   { action: "run", limit: N }   — process up to N entries (default 200)
 *   { action: "dry_run", limit: N } — simulate without deleting
 *
 * Requires admin authorization.
 */
const handler = async (req: Request): Promise<Response> => {
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
  const authHeader = req.headers.get("Authorization") || "";
  let isAuthorized = authHeader.includes(serviceKey);

  if (!isAuthorized) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (anonKey && authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const admin = createClient(supabaseUrl, serviceKey);
        const { data: roleData } = await admin
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
  const action = body.action || "status";
  const limit = Math.min(body.limit || 200, 2000);
  const dryRun = action === "dry_run";

  // BGG headers
  const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
  const bggHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "application/xml",
    Referer: "https://boardgamegeek.com/",
    Origin: "https://boardgamegeek.com",
  };
  if (bggCookie) bggHeaders["Cookie"] = bggCookie;

  // =========================================================================
  // STATUS
  // =========================================================================
  if (action === "status") {
    // Total entries with a BGG ID
    const { count: total } = await admin
      .from("game_catalog")
      .select("id", { count: "exact", head: true })
      .not("bgg_id", "is", null);

    // Linked to a user game (safe — never delete these regardless of type)
    const { count: linked } = await admin
      .from("games")
      .select("id", { count: "exact", head: true })
      .not("catalog_id", "is", null);

    // Sentinel-marked (already identified as non-boardgame by formatter)
    const { count: sentinel } = await admin
      .from("game_catalog")
      .select("id", { count: "exact", head: true })
      .like("description", "%This entry does not appear to be a board game%");

    return new Response(JSON.stringify({
      total_with_bgg_id: total || 0,
      linked_to_library: linked || 0,
      sentinel_marked: sentinel || 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // =========================================================================
  // RUN / DRY_RUN
  // =========================================================================
  if (action !== "run" && action !== "dry_run") {
    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch candidates: catalog entries with a BGG ID that are NOT linked to any user game
  // We page through them in chunks of BATCH_SIZE
  let offset = 0;
  let totalChecked = 0;
  let totalDeleted = 0;
  let totalKept = 0;
  let totalErrors = 0;
  const deletedTitles: string[] = [];
  const errorList: string[] = [];

  console.log(`[catalog-cleanup] Starting ${dryRun ? "DRY RUN" : "run"} — limit ${limit}`);

  while (totalChecked < limit) {
    const fetchCount = Math.min(BATCH_SIZE, limit - totalChecked);

    // Get a batch of catalog entries with bgg_id, not linked to any user game
    const { data: candidates, error: fetchErr } = await admin
      .from("game_catalog")
      .select("id, bgg_id, title")
      .not("bgg_id", "is", null)
      // Skip sentinel-marked entries — already handled
      .not("description", "like", "%This entry does not appear to be a board game%")
      .limit(fetchCount)
      .range(offset, offset + fetchCount - 1);

    if (fetchErr) {
      errorList.push(`Fetch error at offset ${offset}: ${fetchErr.message}`);
      break;
    }
    if (!candidates || candidates.length === 0) break;

    // Filter out any that are linked to a user game (safety check in-memory)
    const candidateIds = candidates.map(c => c.id);
    const { data: linkedGames } = await admin
      .from("games")
      .select("catalog_id")
      .in("catalog_id", candidateIds);
    const linkedSet = new Set((linkedGames || []).map(g => g.catalog_id));

    const unlinked = candidates.filter(c => !linkedSet.has(c.id));
    if (unlinked.length === 0) {
      offset += fetchCount;
      totalChecked += candidates.length;
      continue;
    }

    // Build BGG API request for unlinked candidates
    const bggIds = unlinked.map(c => c.bgg_id!);
    const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggIds.join(",")}&stats=0`;

    let xml: string | null = null;
    let attempts = 0;
    while (attempts < 3 && !xml) {
      attempts++;
      try {
        const res = await fetch(url, { headers: bggHeaders });
        if (res.status === 429) { await sleep(attempts * 4000); continue; }
        if (res.status === 202) { await sleep(5000); continue; }
        if (!res.ok) {
          errorList.push(`BGG HTTP ${res.status} for IDs ${bggIds.join(",")}`);
          break;
        }
        xml = await res.text();
      } catch (e) {
        if (attempts < 3) await sleep(2000);
        else errorList.push(`Fetch error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!xml) {
      totalErrors += unlinked.length;
      offset += fetchCount;
      totalChecked += candidates.length;
      continue;
    }

    const typeMap = parseTypes(xml);

    // Build delete list: entries whose BGG type is NOT allowed
    const toDelete: { id: string; bgg_id: string; title: string }[] = [];
    for (const entry of unlinked) {
      const type = typeMap.get(entry.bgg_id!);
      if (type === undefined) {
        // BGG returned no record for this ID (deleted/invalid) — also remove
        toDelete.push(entry as { id: string; bgg_id: string; title: string });
      } else if (!ALLOWED_TYPES.has(type)) {
        toDelete.push(entry as { id: string; bgg_id: string; title: string });
      } else {
        totalKept++;
      }
    }

    console.log(`[catalog-cleanup] Batch offset=${offset}: ${unlinked.length} checked, ${toDelete.length} to delete`);

    if (!dryRun && toDelete.length > 0) {
      const { error: delErr } = await admin
        .from("game_catalog")
        .delete()
        .in("id", toDelete.map(d => d.id));
      if (delErr) {
        errorList.push(`Delete error: ${delErr.message}`);
        totalErrors += toDelete.length;
      } else {
        totalDeleted += toDelete.length;
        deletedTitles.push(...toDelete.map(d => `${d.title} (bgg:${d.bgg_id})`));
      }
    } else if (dryRun) {
      totalDeleted += toDelete.length; // count as "would delete"
      deletedTitles.push(...toDelete.map(d => `${d.title} (bgg:${d.bgg_id})`));
    }

    totalChecked += candidates.length;
    offset += fetchCount;

    // Rate-limit pause
    if (totalChecked < limit) await sleep(1500);
  }

  // Write to system log
  await admin.from("system_logs").insert({
    level: "info",
    source: "catalog-cleanup",
    message: `${dryRun ? "[DRY RUN] " : ""}Checked ${totalChecked}, deleted ${totalDeleted}, kept ${totalKept}, errors ${totalErrors}`,
    metadata: {
      dry_run: dryRun,
      checked: totalChecked,
      deleted: totalDeleted,
      kept: totalKept,
      errors: totalErrors,
      sample_deleted: deletedTitles.slice(0, 20),
    },
  });

  return new Response(JSON.stringify({
    dry_run: dryRun,
    checked: totalChecked,
    deleted: totalDeleted,
    kept: totalKept,
    errors: totalErrors,
    error_list: errorList.slice(0, 10),
    sample_deleted: deletedTitles.slice(0, 50),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
};

export default handler;
if (import.meta.main) { Deno.serve(handler); }
