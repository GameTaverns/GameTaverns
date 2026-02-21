import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const decodeHtmlEntities = (input: string) =>
  input
    .replace(/&#10;/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : _m;
    });

interface ParsedEnrichment {
  bggId: string;
  itemType: string;
  mechanics: string[];
  designers: string[];
  artists: string[];
  publisher?: string;
  description?: string;
  bggCommunityRating: number | null;
  weight: number | null;
}

/** Parse multi-item BGG XML into enrichment data */
function parseBggXmlBatch(xml: string): ParsedEnrichment[] {
  const results: ParsedEnrichment[] = [];
  const itemRegex = /<item\s+type="([^"]*)"[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemType = match[1];
    const bggId = match[2];
    const block = match[3];

    const mechanicsMatches = block.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]+)"/g);
    const mechanics = [...mechanicsMatches].map((m) => decodeHtmlEntities(m[1]));
    const publisherMatch = block.match(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]+)"/);
    const designerMatches = block.matchAll(/<link[^>]*type="boardgamedesigner"[^>]*value="([^"]+)"/g);
    const designers = [...designerMatches].map((m) => decodeHtmlEntities(m[1]));
    const artistMatches = block.matchAll(/<link[^>]*type="boardgameartist"[^>]*value="([^"]+)"/g);
    const artists = [...artistMatches].map((m) => decodeHtmlEntities(m[1]));
    const descMatch = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    const description = descMatch?.[1] ? decodeHtmlEntities(descMatch[1]).trim().slice(0, 5000) : undefined;
    const ratingMatch = block.match(/<average\s+value="([^"]+)"/);
    const bggRating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
    const weightMatch = block.match(/<averageweight\s+value="([^"]+)"/);
    const weight = weightMatch ? parseFloat(weightMatch[1]) : null;

    results.push({
      bggId,
      itemType,
      mechanics,
      designers,
      artists,
      publisher: publisherMatch?.[1] ? decodeHtmlEntities(publisherMatch[1]) : undefined,
      description,
      bggCommunityRating: bggRating && !isNaN(bggRating) && bggRating > 0
        ? Math.round(bggRating * 10) / 10 : null,
      weight: weight && !isNaN(weight) && weight > 0 ? Math.round(weight * 100) / 100 : null,
    });
  }
  return results;
}

/**
 * Catalog Backfill — populates game_catalog with designers, artists,
 * and enriched descriptions from BGG.
 *
 * Modes:
 * - status: Return enrichment progress counts
 * - enrich: Batch-fetch BGG XML (20 IDs per request) to add designers/artists/weight/rating
 * - type-check: Batch-tag entries with bgg_verified_type for cleanup identification
 * - sync-ratings: Aggregate user ratings into catalog
 * - test: Single BGG fetch diagnostic
 * - default: Link unlinked games to catalog entries
 *
 * Params: { mode, batch_size (default 20, max 100 for enrich), offset }
 */
const handler = async (req: Request): Promise<Response> => {
  console.log("[catalog-backfill] Handler invoked", req.method);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceKey;

    if (!isServiceRole) {
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleData } = await admin
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "default";
    console.log("[catalog-backfill] Mode:", mode);

    // Build BGG auth headers
    const bggApiToken = Deno.env.get("BGG_API_TOKEN") || "";
    const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
    const bggHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/xml",
      Referer: "https://boardgamegeek.com/",
      Origin: "https://boardgamegeek.com",
    };
    if (bggApiToken) bggHeaders["Authorization"] = `Bearer ${bggApiToken}`;
    if (bggCookie) bggHeaders["Cookie"] = bggCookie;

    // =====================================================================
    // MODE: status
    // =====================================================================
    if (mode === "status") {
      const { data: stats, error: statsErr } = await admin.rpc("get_catalog_enrichment_status");
      if (statsErr) {
        return new Response(JSON.stringify({ error: statsErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const totalWithBgg = stats?.total_with_bgg || 0;
      const remaining = stats?.remaining || 0;
      const enrichedCount = totalWithBgg - remaining;
      return new Response(JSON.stringify({
        total_with_bgg: totalWithBgg, enriched: enrichedCount,
        has_designers: stats?.has_designers || 0, has_artists: stats?.has_artists || 0,
        has_rating: stats?.has_rating || 0, remaining,
        percent: totalWithBgg ? Math.round((enrichedCount / totalWithBgg) * 100) : 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: test
    // =====================================================================
    if (mode === "test") {
      const testBggId = body.bgg_id || "174430";
      const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${testBggId}&stats=1`;
      try {
        const res = await fetch(xmlUrl, { headers: bggHeaders });
        const text = await res.text();
        const parsed = parseBggXmlBatch(text);
        return new Response(JSON.stringify({
          success: true, mode: "test", bgg_id: testBggId, http_status: res.status,
          items_found: parsed.length,
          parsed_preview: parsed[0] ? {
            type: parsed[0].itemType, designers: parsed[0].designers.length,
            artists: parsed[0].artists.length, rating: parsed[0].bggCommunityRating,
            weight: parsed[0].weight,
          } : null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // =====================================================================
    // MODE: enrich — BATCHED: fetch 20 BGG IDs per API call, process multiple batches
    // =====================================================================
    if (mode === "enrich") {
      const BGG_BATCH_SIZE = 20; // BGG API supports up to 20 IDs per request
      const batchSize = Math.min(body.batch_size || 20, 100); // Default reduced to 20 to avoid timeout

      // Get unenriched entries
      const { data: catalogEntries, error: catErr } = await admin
        .rpc("get_unenriched_catalog_entries", { p_limit: batchSize });

      if (catErr) {
        return new Response(JSON.stringify({ error: catErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!catalogEntries || catalogEntries.length === 0) {
        return new Response(JSON.stringify({
          success: true, processed: 0, message: "No more entries to enrich", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[catalog-backfill] Enriching ${catalogEntries.length} entries`);

      let processed = 0;
      let designersAdded = 0;
      let artistsAdded = 0;
      const errors: string[] = [];

      // Build a map of catalog entries by bgg_id for fast lookup
      const entryMap = new Map<string, { id: string; title: string; bgg_id: string }>();
      for (const entry of catalogEntries) {
        entryMap.set(entry.bgg_id, entry);
      }

      // Pre-cache all designer/artist names we'll need to avoid repeated lookups
      const designerCache = new Map<string, string>(); // name -> id
      const artistCache = new Map<string, string>(); // name -> id

      // Process in chunks of 20 (one BGG API call per chunk)
      const allBggIds = catalogEntries.map((e: any) => e.bgg_id);
      for (let i = 0; i < allBggIds.length; i += BGG_BATCH_SIZE) {
        const chunk = allBggIds.slice(i, i + BGG_BATCH_SIZE);
        const idStr = chunk.join(",");
        const url = `https://boardgamegeek.com/xmlapi2/thing?id=${idStr}&stats=1`;

        let xml: string | null = null;
        let fetchAttempts = 0;
        while (fetchAttempts < 3 && !xml) {
          fetchAttempts++;
          try {
            const res = await fetch(url, { headers: bggHeaders });
            if (res.status === 429) {
              console.log(`[catalog-backfill] Rate limited, waiting ${fetchAttempts * 3}s`);
              await sleep(fetchAttempts * 3000);
              continue;
            }
            if (res.status === 202) {
              console.log(`[catalog-backfill] BGG queued (202), waiting 3s`);
              await sleep(3000);
              continue;
            }
            if (res.ok) xml = await res.text();
            else {
              errors.push(`BGG HTTP ${res.status} for chunk starting at ${chunk[0]}`);
              break;
            }
          } catch (e) {
            errors.push(`Fetch error: ${e instanceof Error ? e.message : String(e)}`);
            if (fetchAttempts < 3) await sleep(2000);
          }
        }

        if (!xml) continue;

        const parsed = parseBggXmlBatch(xml);
        console.log(`[catalog-backfill] Chunk ${Math.floor(i / BGG_BATCH_SIZE) + 1}: got ${parsed.length} items from ${chunk.length} IDs`);

        for (const item of parsed) {
          const entry = entryMap.get(item.bggId);
          if (!entry) continue;

          try {
            // Update catalog entry with rating, weight, description, and verified type
            const catalogUpdate: Record<string, unknown> = {
              bgg_verified_type: item.itemType,
            };
            if (item.bggCommunityRating !== null) catalogUpdate.bgg_community_rating = item.bggCommunityRating;
            if (item.weight !== null) catalogUpdate.weight = item.weight;
            if (item.description) catalogUpdate.description = item.description;
            await admin.from("game_catalog").update(catalogUpdate).eq("id", entry.id);

            // Bulk upsert designers — collect IDs first
            const designerRows: { catalog_id: string; designer_id: string }[] = [];
            for (const name of item.designers) {
              let dId = designerCache.get(name);
              if (!dId) {
                const { data: d } = await admin.from("designers").upsert({ name }, { onConflict: "name" }).select("id").single();
                if (d?.id) { dId = d.id; designerCache.set(name, dId); }
              }
              if (dId) designerRows.push({ catalog_id: entry.id, designer_id: dId });
            }
            if (designerRows.length > 0) {
              const { error: dErr } = await admin.from("catalog_designers").upsert(designerRows, { onConflict: "catalog_id,designer_id" });
              if (!dErr) designersAdded += designerRows.length;
              else errors.push(`designers for ${entry.title}: ${dErr.message}`);
            }

            // Bulk upsert artists — collect IDs first
            const artistRows: { catalog_id: string; artist_id: string }[] = [];
            for (const name of item.artists) {
              let aId = artistCache.get(name);
              if (!aId) {
                const { data: a } = await admin.from("artists").upsert({ name }, { onConflict: "name" }).select("id").single();
                if (a?.id) { aId = a.id; artistCache.set(name, aId); }
              }
              if (aId) artistRows.push({ catalog_id: entry.id, artist_id: aId });
            }
            if (artistRows.length > 0) {
              const { error: aErr } = await admin.from("catalog_artists").upsert(artistRows, { onConflict: "catalog_id,artist_id" });
              if (!aErr) artistsAdded += artistRows.length;
              else errors.push(`artists for ${entry.title}: ${aErr.message}`);
            }

            // Backfill linked games too (bulk)
            const { data: linkedGames } = await admin.from("games").select("id").eq("catalog_id", entry.id);
            if (linkedGames && linkedGames.length > 0) {
              for (const game of linkedGames) {
                if (designerRows.length > 0) {
                  await admin.from("game_designers").upsert(
                    designerRows.map(d => ({ game_id: game.id, designer_id: d.designer_id })),
                    { onConflict: "game_id,designer_id" }
                  );
                }
                if (artistRows.length > 0) {
                  await admin.from("game_artists").upsert(
                    artistRows.map(a => ({ game_id: game.id, artist_id: a.artist_id })),
                    { onConflict: "game_id,artist_id" }
                  );
                }
              }
            }

            processed++;
          } catch (e) {
            errors.push(`${entry.title}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        // Rate-limit pause between BGG API calls
        if (i + BGG_BATCH_SIZE < allBggIds.length) {
          await sleep(1000);
        }
      }

      const hasMore = catalogEntries.length === batchSize;
      return new Response(JSON.stringify({
        success: true, mode: "enrich", processed, designersAdded, artistsAdded,
        total: catalogEntries.length, hasMore, errors: errors.slice(0, 20),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: type-check — Lightweight batch tagging of bgg_verified_type
    // Does NOT enrich designers/artists — just tags the type for cleanup
    // =====================================================================
    if (mode === "type-check") {
      const batchSize = Math.min(body.batch_size || 200, 500);
      const BGG_BATCH_SIZE = 20;

      // Get entries with BGG ID but no verified type
      const { data: entries, error: fetchErr } = await admin
        .from("game_catalog")
        .select("id, bgg_id")
        .not("bgg_id", "is", null)
        .is("bgg_verified_type", null)
        .order("created_at", { ascending: true })
        .limit(batchSize);

      if (fetchErr) {
        return new Response(JSON.stringify({ error: fetchErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!entries || entries.length === 0) {
        return new Response(JSON.stringify({
          success: true, mode: "type-check", tagged: 0, message: "All entries already tagged", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[catalog-backfill] Type-checking ${entries.length} entries`);

      let tagged = 0;
      let notFound = 0;
      const errors: string[] = [];
      const entryMap = new Map<string, string>(); // bgg_id -> catalog id
      for (const e of entries) {
        entryMap.set(e.bgg_id, e.id);
      }

      const allBggIds = entries.map((e: any) => e.bgg_id);
      for (let i = 0; i < allBggIds.length; i += BGG_BATCH_SIZE) {
        const chunk = allBggIds.slice(i, i + BGG_BATCH_SIZE);
        const idStr = chunk.join(",");
        // Don't use type filter — we want to see ALL types to identify non-board-games
        const url = `https://boardgamegeek.com/xmlapi2/thing?id=${idStr}&stats=1`;

        let xml: string | null = null;
        let fetchAttempts = 0;
        while (fetchAttempts < 3 && !xml) {
          fetchAttempts++;
          try {
            const res = await fetch(url, { headers: bggHeaders });
            if (res.status === 429) { await sleep(fetchAttempts * 3000); continue; }
            if (res.status === 202) { await sleep(3000); continue; }
            if (res.ok) xml = await res.text();
            else break;
          } catch { if (fetchAttempts < 3) await sleep(2000); }
        }

        if (!xml) {
          errors.push(`Failed to fetch chunk starting at BGG ID ${chunk[0]}`);
          continue;
        }

        // Parse just the type from each item
        const itemRegex = /<item\s+type="([^"]*)"[^>]*id="(\d+)"[^>]*>/g;
        const foundIds = new Set<string>();
        let itemMatch;
        while ((itemMatch = itemRegex.exec(xml)) !== null) {
          const itemType = itemMatch[1];
          const bggId = itemMatch[2];
          foundIds.add(bggId);
          const catalogId = entryMap.get(bggId);
          if (catalogId) {
            await admin.from("game_catalog").update({ bgg_verified_type: itemType }).eq("id", catalogId);
            tagged++;
          }
        }

        // Mark IDs not found in BGG response as "not_found"
        for (const bggId of chunk) {
          if (!foundIds.has(bggId)) {
            const catalogId = entryMap.get(bggId);
            if (catalogId) {
              await admin.from("game_catalog").update({ bgg_verified_type: "not_found" }).eq("id", catalogId);
              notFound++;
            }
          }
        }

        // Rate-limit
        if (i + BGG_BATCH_SIZE < allBggIds.length) {
          await sleep(500);
        }
      }

      const hasMore = entries.length === batchSize;
      return new Response(JSON.stringify({
        success: true, mode: "type-check", tagged, notFound, total: entries.length,
        hasMore, errors: errors.slice(0, 10),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: re-enrich — Monthly refresh of BGG ratings/weight for existing entries
    // Processes entries that haven't been updated in 30+ days
    // =====================================================================
    if (mode === "re-enrich") {
      const BGG_BATCH_SIZE = 20;
      const batchSize = Math.min(body.batch_size || 60, 200);

      // Get entries updated more than 30 days ago (stale data)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: staleEntries, error: staleErr } = await admin
        .from("game_catalog")
        .select("id, bgg_id")
        .not("bgg_id", "is", null)
        .eq("bgg_verified_type", "boardgame")
        .lt("updated_at", thirtyDaysAgo)
        .order("updated_at", { ascending: true })
        .limit(batchSize);

      if (staleErr) {
        return new Response(JSON.stringify({ error: staleErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!staleEntries || staleEntries.length === 0) {
        return new Response(JSON.stringify({
          success: true, mode: "re-enrich", refreshed: 0, message: "No stale entries", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[catalog-backfill] Re-enriching ${staleEntries.length} stale entries`);

      let refreshed = 0;
      const errors: string[] = [];
      const entryMap = new Map<string, string>();
      for (const e of staleEntries) entryMap.set(e.bgg_id, e.id);

      const allBggIds = staleEntries.map((e: any) => e.bgg_id);
      for (let i = 0; i < allBggIds.length; i += BGG_BATCH_SIZE) {
        const chunk = allBggIds.slice(i, i + BGG_BATCH_SIZE);
        const url = `https://boardgamegeek.com/xmlapi2/thing?id=${chunk.join(",")}&stats=1`;

        let xml: string | null = null;
        let fetchAttempts = 0;
        while (fetchAttempts < 3 && !xml) {
          fetchAttempts++;
          try {
            const res = await fetch(url, { headers: bggHeaders });
            if (res.status === 429) { await sleep(fetchAttempts * 3000); continue; }
            if (res.status === 202) { await sleep(3000); continue; }
            if (res.ok) xml = await res.text();
            else break;
          } catch { if (fetchAttempts < 3) await sleep(2000); }
        }

        if (!xml) { errors.push(`Failed chunk starting at ${chunk[0]}`); continue; }

        const parsed = parseBggXmlBatch(xml);
        for (const item of parsed) {
          const catalogId = entryMap.get(item.bggId);
          if (!catalogId) continue;
          try {
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (item.bggCommunityRating !== null) updates.bgg_community_rating = item.bggCommunityRating;
            if (item.weight !== null) updates.weight = item.weight;
            await admin.from("game_catalog").update(updates).eq("id", catalogId);
            refreshed++;
          } catch (e) {
            errors.push(`${item.bggId}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        if (i + BGG_BATCH_SIZE < allBggIds.length) await sleep(1000);
      }

      const hasMore = staleEntries.length === batchSize;
      return new Response(JSON.stringify({
        success: true, mode: "re-enrich", refreshed, total: staleEntries.length, hasMore, errors: errors.slice(0, 10),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: dedup — Merge duplicate catalog entries with same BGG ID or title
    // =====================================================================
    if (mode === "dedup") {
      // Find duplicate BGG IDs (keep the oldest entry, merge others)
      const { data: dupes, error: dupeErr } = await admin.rpc("find_catalog_duplicates");
      
      if (dupeErr) {
        // If RPC doesn't exist yet, do inline query
        const { data: rawDupes } = await admin
          .from("game_catalog")
          .select("bgg_id")
          .not("bgg_id", "is", null)
          .order("bgg_id");

        // Count dupes in JS
        const bggIdCounts = new Map<string, number>();
        for (const d of rawDupes || []) {
          bggIdCounts.set(d.bgg_id, (bggIdCounts.get(d.bgg_id) || 0) + 1);
        }

        let merged = 0;
        const errors: string[] = [];
        for (const [bggId, count] of bggIdCounts) {
          if (count <= 1) continue;
          // Get all entries for this bgg_id, keep oldest
          const { data: entries } = await admin
            .from("game_catalog")
            .select("id, created_at")
            .eq("bgg_id", bggId)
            .order("created_at", { ascending: true });

          if (!entries || entries.length <= 1) continue;
          const keepId = entries[0].id;
          const removeIds = entries.slice(1).map(e => e.id);

          try {
            // Reassign all foreign keys to the kept entry
            for (const removeId of removeIds) {
              await admin.from("games").update({ catalog_id: keepId }).eq("catalog_id", removeId);
              await admin.from("catalog_mechanics").update({ catalog_id: keepId }).eq("catalog_id", removeId);
              await admin.from("catalog_publishers").update({ catalog_id: keepId }).eq("catalog_id", removeId);
              await admin.from("catalog_designers").update({ catalog_id: keepId }).eq("catalog_id", removeId);
              await admin.from("catalog_artists").update({ catalog_id: keepId }).eq("catalog_id", removeId);
              await admin.from("catalog_videos").update({ catalog_id: keepId }).eq("catalog_id", removeId);
              await admin.from("catalog_ratings").update({ catalog_id: keepId }).eq("catalog_id", removeId);
              await admin.from("catalog_corrections").update({ catalog_id: keepId }).eq("catalog_id", removeId);
              // Delete the duplicate
              await admin.from("game_catalog").delete().eq("id", removeId);
              merged++;
            }
          } catch (e) {
            errors.push(`${bggId}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        return new Response(JSON.stringify({
          success: true, mode: "dedup", merged, errors: errors.slice(0, 20),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true, mode: "dedup", message: "Used RPC" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================================
    // MODE: sync-ratings
    // =====================================================================
    if (mode === "sync-ratings") {
      const batchSize = Math.min(body.batch_size || 5, 10);
      const offset = body.offset || 0;
      const { data: catalogEntries, error: catErr } = await admin
        .from("game_catalog").select("id").order("title").range(offset, offset + batchSize - 1);

      if (catErr) {
        return new Response(JSON.stringify({ error: catErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!catalogEntries || catalogEntries.length === 0) {
        return new Response(JSON.stringify({
          success: true, processed: 0, ratingsUpdated: 0, message: "No more entries", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let ratingsUpdated = 0;
      let processed = 0;

      for (const entry of catalogEntries) {
        const { data: linkedGames } = await admin.from("games").select("id").eq("catalog_id", entry.id);
        if (!linkedGames || linkedGames.length === 0) continue;

        const gameIds = linkedGames.map(g => g.id);
        const { data: bggRatings } = await admin
          .from("game_ratings").select("rating").in("game_id", gameIds)
          .eq("guest_identifier", "bgg-community").limit(1);

        if (bggRatings && bggRatings.length > 0) {
          const bgg10 = bggRatings[0].rating * 2;
          const { data: current } = await admin.from("game_catalog").select("bgg_community_rating").eq("id", entry.id).single();
          if (!current?.bgg_community_rating || current.bgg_community_rating <= 0) {
            await admin.from("game_catalog").update({ bgg_community_rating: bgg10 }).eq("id", entry.id);
            ratingsUpdated++;
          }
        }
        processed++;
      }

      const hasMore = catalogEntries.length === batchSize;
      return new Response(JSON.stringify({
        success: true, mode: "sync-ratings", processed, ratingsUpdated,
        offset, nextOffset: offset + batchSize, hasMore,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // DEFAULT MODE: Link unlinked games to catalog
    // =====================================================================
    const batchSize = Math.min(body.batch_size || 5, 10);
    const { data: unlinkedGames, error: fetchErr } = await admin
      .from("games")
      .select("id, bgg_id, title, image_url, description, min_players, max_players, play_time, difficulty, is_expansion, bgg_url, suggested_age, publisher_id")
      .not("bgg_id", "is", null)
      .is("catalog_id", null)
      .limit(batchSize);

    if (fetchErr) throw fetchErr;
    if (!unlinkedGames || unlinkedGames.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, linked: 0, message: "All games already linked", hasMore: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const byBggId = new Map<string, typeof unlinkedGames>();
    for (const game of unlinkedGames) {
      if (!game.bgg_id) continue;
      const existing = byBggId.get(game.bgg_id) || [];
      existing.push(game);
      byBggId.set(game.bgg_id, existing);
    }

    let processed = 0;
    let linked = 0;
    const errors: string[] = [];

    const weightMap: Record<string, number> = {
      "1 - Light": 1.25, "2 - Medium Light": 1.88, "3 - Medium": 2.63,
      "4 - Medium Heavy": 3.38, "5 - Heavy": 4.25,
    };
    const timeMap: Record<string, number> = {
      "0-15 Minutes": 15, "15-30 Minutes": 30, "30-45 Minutes": 45,
      "45-60 Minutes": 60, "60+ Minutes": 90, "2+ Hours": 150, "3+ Hours": 210,
    };

    for (const [bggId, games] of byBggId) {
      const firstGame = games[0];
      try {
        const catalogData: Record<string, unknown> = {
          bgg_id: bggId, title: firstGame.title, image_url: firstGame.image_url || null,
          description: firstGame.description?.slice(0, 10000) || null,
          min_players: firstGame.min_players || null, max_players: firstGame.max_players || null,
          play_time_minutes: firstGame.play_time ? timeMap[firstGame.play_time] || null : null,
          weight: firstGame.difficulty ? weightMap[firstGame.difficulty] || null : null,
          suggested_age: firstGame.suggested_age || null,
          is_expansion: firstGame.is_expansion === true,
          bgg_url: firstGame.bgg_url || `https://boardgamegeek.com/boardgame/${bggId}`,
        };

        const { data: entry, error: upsertErr } = await admin
          .from("game_catalog").upsert(catalogData, { onConflict: "bgg_id" }).select("id").single();
        if (upsertErr) { errors.push(`${bggId}: ${upsertErr.message}`); continue; }

        if (entry?.id) {
          const gameIds = games.map(g => g.id);
          await admin.from("games").update({ catalog_id: entry.id }).in("id", gameIds);
          linked += gameIds.length;

          const { data: mechs } = await admin.from("game_mechanics").select("mechanic_id").eq("game_id", firstGame.id);
          if (mechs) {
            for (const m of mechs) {
              await admin.from("catalog_mechanics").upsert({ catalog_id: entry.id, mechanic_id: m.mechanic_id }, { onConflict: "catalog_id,mechanic_id" });
            }
          }
          if (firstGame.publisher_id) {
            await admin.from("catalog_publishers").upsert({ catalog_id: entry.id, publisher_id: firstGame.publisher_id }, { onConflict: "catalog_id,publisher_id" });
          }
          const { data: gDesigners } = await admin.from("game_designers").select("designer_id").eq("game_id", firstGame.id);
          if (gDesigners) {
            for (const d of gDesigners) {
              await admin.from("catalog_designers").upsert({ catalog_id: entry.id, designer_id: d.designer_id }, { onConflict: "catalog_id,designer_id" });
            }
          }
          const { data: gArtists } = await admin.from("game_artists").select("artist_id").eq("game_id", firstGame.id);
          if (gArtists) {
            for (const a of gArtists) {
              await admin.from("catalog_artists").upsert({ catalog_id: entry.id, artist_id: a.artist_id }, { onConflict: "catalog_id,artist_id" });
            }
          }
        }
        processed++;
      } catch (e) {
        errors.push(`${bggId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const hasMore = unlinkedGames.length === batchSize;
    return new Response(
      JSON.stringify({ success: true, unique_bgg_ids: byBggId.size, processed, linked, hasMore, errors: errors.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
