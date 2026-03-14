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
  bggCommunityRating: number | null; // kept for parsing but no longer stored
  weight: number | null;
  yearPublished: number | null;
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
    const yearMatch = block.match(/<yearpublished[^>]*value="([^"]+)"/);
    const yearPublished = yearMatch ? parseInt(yearMatch[1]) || null : null;

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
      yearPublished,
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

    const token = authHeader.replace("Bearer ", "").trim();

    let tokenRole: string | null = null;
    try {
      tokenRole = JSON.parse(atob(token.split(".")[1]))?.role ?? null;
    } catch {
      tokenRole = null;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || (tokenRole === "service_role" ? token : "");

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Function misconfigured: missing SUPABASE_URL/API_EXTERNAL_URL or SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Accept service role key, anon key, or anon-role JWTs as internal/cron calls
    let isInternalCall = token === serviceKey || (!!anonKey && token === anonKey) || tokenRole === "anon" || tokenRole === "service_role";

    if (!isInternalCall) {
      if (!anonKey) {
        return new Response(JSON.stringify({ error: "Function misconfigured: missing SUPABASE_ANON_KEY/ANON_KEY" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
    // MODE: enrich — HIGH-THROUGHPUT: pre-cached names, bulk upserts, 100 per batch
    // =====================================================================
    if (mode === "enrich") {
      const BGG_BATCH_SIZE = 20; // BGG API supports up to 20 IDs per request
      const batchSize = Math.min(body.batch_size || 100, 200);
      const skipGameBackfill = body.skip_game_backfill !== false; // default true for speed

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

      console.log(`[catalog-backfill] Enriching ${catalogEntries.length} entries (skip_game_backfill=${skipGameBackfill})`);

      // ── Pre-load ALL existing designer & artist names into memory ──
      const designerCache = new Map<string, string>(); // name -> id
      const artistCache = new Map<string, string>(); // name -> id

      // Fetch all designers (typically < 50k rows, ~2MB)
      let dOffset = 0;
      const D_PAGE = 1000;
      while (true) {
        const { data: dPage } = await admin.from("designers").select("id, name").range(dOffset, dOffset + D_PAGE - 1);
        if (!dPage || dPage.length === 0) break;
        for (const d of dPage) designerCache.set(d.name, d.id);
        if (dPage.length < D_PAGE) break;
        dOffset += D_PAGE;
      }

      // Fetch all artists
      let aOffset = 0;
      while (true) {
        const { data: aPage } = await admin.from("artists").select("id, name").range(aOffset, aOffset + D_PAGE - 1);
        if (!aPage || aPage.length === 0) break;
        for (const a of aPage) artistCache.set(a.name, a.id);
        if (aPage.length < D_PAGE) break;
        aOffset += D_PAGE;
      }

      console.log(`[catalog-backfill] Cached ${designerCache.size} designers, ${artistCache.size} artists`);

      let processed = 0;
      let designersAdded = 0;
      let artistsAdded = 0;
      const errors: string[] = [];

      const entryMap = new Map<string, { id: string; title: string; bgg_id: string; description?: string }>();
      // Fetch descriptions for these entries so we can guard against overwriting formatted ones
      const entryIds = catalogEntries.map((e: any) => e.id);
      const descMap = new Map<string, string | null>();
      for (let d = 0; d < entryIds.length; d += 200) {
        const batch = entryIds.slice(d, d + 200);
        const { data: descRows } = await admin.from("game_catalog").select("id, description").in("id", batch);
        if (descRows) for (const r of descRows) descMap.set(r.id, r.description);
      }
      for (const entry of catalogEntries) {
        (entry as any).description = descMap.get(entry.id) || null;
        entryMap.set(entry.bgg_id, entry as any);
      }

      const allBggIds = catalogEntries.map((e: any) => e.bgg_id);
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
            else { errors.push(`BGG HTTP ${res.status} for chunk ${chunk[0]}`); break; }
          } catch (e) {
            errors.push(`Fetch error: ${e instanceof Error ? e.message : String(e)}`);
            if (fetchAttempts < 3) await sleep(2000);
          }
        }

        if (!xml) continue;

        const parsed = parseBggXmlBatch(xml);
        console.log(`[catalog-backfill] Chunk ${Math.floor(i / BGG_BATCH_SIZE) + 1}: ${parsed.length} items`);

        // ── Collect ALL new designer/artist names from this chunk to batch-insert ──
        const newDesignerNames = new Set<string>();
        const newArtistNames = new Set<string>();
        for (const item of parsed) {
          for (const n of item.designers) if (!designerCache.has(n)) newDesignerNames.add(n);
          for (const n of item.artists) if (!artistCache.has(n)) newArtistNames.add(n);
        }

        // Batch-insert new designers
        if (newDesignerNames.size > 0) {
          const rows = [...newDesignerNames].map(name => ({ name }));
          // Insert in sub-batches of 500 to avoid payload limits
          for (let j = 0; j < rows.length; j += 500) {
            const subBatch = rows.slice(j, j + 500);
            const { data: inserted } = await admin.from("designers")
              .upsert(subBatch, { onConflict: "name", ignoreDuplicates: true })
              .select("id, name");
            if (inserted) for (const d of inserted) designerCache.set(d.name, d.id);
          }
          // Re-fetch any that were already present (upsert with ignoreDuplicates may not return them)
          const missing = [...newDesignerNames].filter(n => !designerCache.has(n));
          if (missing.length > 0) {
            const { data: existing } = await admin.from("designers").select("id, name").in("name", missing);
            if (existing) for (const d of existing) designerCache.set(d.name, d.id);
          }
        }

        // Batch-insert new artists
        if (newArtistNames.size > 0) {
          const rows = [...newArtistNames].map(name => ({ name }));
          for (let j = 0; j < rows.length; j += 500) {
            const subBatch = rows.slice(j, j + 500);
            const { data: inserted } = await admin.from("artists")
              .upsert(subBatch, { onConflict: "name", ignoreDuplicates: true })
              .select("id, name");
            if (inserted) for (const a of inserted) artistCache.set(a.name, a.id);
          }
          const missing = [...newArtistNames].filter(n => !artistCache.has(n));
          if (missing.length > 0) {
            const { data: existing } = await admin.from("artists").select("id, name").in("name", missing);
            if (existing) for (const a of existing) artistCache.set(a.name, a.id);
          }
        }

        // ── Now process each item: bulk catalog update + junction upserts ──
        const allDesignerJunctions: { catalog_id: string; designer_id: string }[] = [];
        const allArtistJunctions: { catalog_id: string; artist_id: string }[] = [];
        const catalogUpdates: Promise<any>[] = [];

        for (const item of parsed) {
          const entry = entryMap.get(item.bggId);
          if (!entry) continue;

          const catalogUpdate: Record<string, unknown> = {
            bgg_verified_type: item.itemType,
            enriched_at: new Date().toISOString(),
          };
          // bgg_community_rating removed — no longer stored
          if (item.weight !== null) catalogUpdate.weight = item.weight;
          if (item.yearPublished !== null) catalogUpdate.year_published = item.yearPublished;
          if (item.description && !(entry.description && entry.description.includes("Quick Gameplay Overview"))) catalogUpdate.description = item.description;
          catalogUpdates.push(admin.from("game_catalog").update(catalogUpdate).eq("id", entry.id));

          for (const name of item.designers) {
            const dId = designerCache.get(name);
            if (dId) allDesignerJunctions.push({ catalog_id: entry.id, designer_id: dId });
          }
          for (const name of item.artists) {
            const aId = artistCache.get(name);
            if (aId) allArtistJunctions.push({ catalog_id: entry.id, artist_id: aId });
          }
          processed++;
        }

        // Fire all catalog updates in parallel
        await Promise.all(catalogUpdates);

        // Bulk upsert all designer junctions for this chunk
        if (allDesignerJunctions.length > 0) {
          for (let j = 0; j < allDesignerJunctions.length; j += 500) {
            const batch = allDesignerJunctions.slice(j, j + 500);
            const { error: dErr } = await admin.from("catalog_designers")
              .upsert(batch, { onConflict: "catalog_id,designer_id" });
            if (dErr) errors.push(`designer junctions: ${dErr.message}`);
            else designersAdded += batch.length;
          }
        }

        // Bulk upsert all artist junctions for this chunk
        if (allArtistJunctions.length > 0) {
          for (let j = 0; j < allArtistJunctions.length; j += 500) {
            const batch = allArtistJunctions.slice(j, j + 500);
            const { error: aErr } = await admin.from("catalog_artists")
              .upsert(batch, { onConflict: "catalog_id,artist_id" });
            if (aErr) errors.push(`artist junctions: ${aErr.message}`);
            else artistsAdded += batch.length;
          }
        }

        // Rate-limit pause between BGG API calls
        if (i + BGG_BATCH_SIZE < allBggIds.length) await sleep(1000);
      }

      const hasMore = catalogEntries.length === batchSize;
      return new Response(JSON.stringify({
        success: true, mode: "enrich", processed, designersAdded, artistsAdded,
        total: catalogEntries.length, hasMore,
        cached_designers: designerCache.size, cached_artists: artistCache.size,
        errors: errors.slice(0, 20),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: backfill-years — Fill year_published for catalog entries that have it missing
    // =====================================================================
    if (mode === "backfill-years") {
      const BGG_BATCH_SIZE = 20;
      const batchSize = Math.min(body.batch_size || 200, 500);

      const { data: entries, error: fetchErr } = await admin
        .from("game_catalog")
        .select("id, bgg_id")
        .not("bgg_id", "is", null)
        .is("year_published", null)
        .order("created_at", { ascending: true })
        .limit(batchSize);

      if (fetchErr) {
        return new Response(JSON.stringify({ error: fetchErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!entries || entries.length === 0) {
        return new Response(JSON.stringify({
          success: true, mode: "backfill-years", processed: 0, message: "All entries have year_published", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[catalog-backfill] backfill-years: ${entries.length} entries missing year_published`);

      let updated = 0;
      const errors: string[] = [];
      const entryMap = new Map(entries.map(e => [e.bgg_id!, e.id]));
      const allBggIds = entries.map(e => e.bgg_id!);

      for (let i = 0; i < allBggIds.length; i += BGG_BATCH_SIZE) {
        const chunk = allBggIds.slice(i, i + BGG_BATCH_SIZE);
        const url = `https://boardgamegeek.com/xmlapi2/thing?id=${chunk.join(",")}&stats=1`;

        let xml: string | null = null;
        let attempts = 0;
        while (attempts < 3 && !xml) {
          attempts++;
          try {
            const res = await fetch(url, { headers: bggHeaders });
            if (res.status === 429) { await sleep(attempts * 3000); continue; }
            if (res.status === 202) { await sleep(3000); continue; }
            if (res.ok) xml = await res.text();
            else { errors.push(`BGG HTTP ${res.status}`); break; }
          } catch (e) {
            errors.push(`Fetch error: ${e instanceof Error ? e.message : String(e)}`);
            if (attempts < 3) await sleep(2000);
          }
        }

        if (!xml) continue;

        const parsed = parseBggXmlBatch(xml);
        const updates: Promise<any>[] = [];
        for (const item of parsed) {
          const catalogId = entryMap.get(item.bggId);
          if (!catalogId || item.yearPublished === null) continue;
          const updateObj: Record<string, unknown> = { year_published: item.yearPublished };
          // Also backfill weight if missing
          if (item.weight !== null) updateObj.weight = item.weight;
          updates.push(admin.from("game_catalog").update(updateObj).eq("id", catalogId));
          updated++;
        }
        await Promise.all(updates);

        if (i + BGG_BATCH_SIZE < allBggIds.length) await sleep(1000);
      }

      const hasMore = entries.length === batchSize;
      return new Response(JSON.stringify({
        success: true, mode: "backfill-years", updated, total: entries.length, hasMore,
        errors: errors.slice(0, 20),
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
    // MODE: fix-missing — Re-enrich entries that were marked enriched but are
    // missing designers/artists (caused by BGG 401 errors during initial enrichment)
    // =====================================================================
    if (mode === "fix-missing") {
      const BGG_BATCH_SIZE = 20;
      const batchSize = Math.min(body.batch_size || 100, 200);

      // Find entries that are enriched but missing designers using efficient SQL
      const { data: catalogEntries, error: incErr } = await admin
        .rpc("get_missing_designer_entries", { p_limit: batchSize });

      if (incErr) {
        return new Response(JSON.stringify({ error: incErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const entryIds = (catalogEntries || []).map((e: any) => e.id);

      if (catalogEntries.length === 0) {
        return new Response(JSON.stringify({
          success: true, mode: "fix-missing", processed: 0,
          message: "No incomplete entries found", hasMore: false,
          checked: entryIds.length,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[catalog-backfill] fix-missing: ${catalogEntries.length} entries missing designers (checked ${entryIds.length})`);

      // Re-use the same enrichment logic as "enrich" mode
      const designerCache = new Map<string, string>();
      const artistCache = new Map<string, string>();
      let dOffset = 0;
      const D_PAGE = 1000;
      while (true) {
        const { data: dPage } = await admin.from("designers").select("id, name").range(dOffset, dOffset + D_PAGE - 1);
        if (!dPage || dPage.length === 0) break;
        for (const d of dPage) designerCache.set(d.name, d.id);
        if (dPage.length < D_PAGE) break;
        dOffset += D_PAGE;
      }
      let aOffset = 0;
      while (true) {
        const { data: aPage } = await admin.from("artists").select("id, name").range(aOffset, aOffset + D_PAGE - 1);
        if (!aPage || aPage.length === 0) break;
        for (const a of aPage) artistCache.set(a.name, a.id);
        if (aPage.length < D_PAGE) break;
        aOffset += D_PAGE;
      }

      console.log(`[catalog-backfill] fix-missing: Cached ${designerCache.size} designers, ${artistCache.size} artists`);

      let processed = 0;
      let designersAdded = 0;
      let artistsAdded = 0;
      let bggErrors = 0;
      const errors: string[] = [];

      const entryMap = new Map<string, { id: string; title: string; bgg_id: string }>();
      for (const entry of catalogEntries) entryMap.set(entry.bgg_id, entry as any);

      const allBggIds = catalogEntries.map((e: any) => e.bgg_id);
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
            if (res.status === 401) {
              errors.push(`BGG 401 Unauthorized — check BGG_API_TOKEN and BGG_SESSION_COOKIE`);
              bggErrors++;
              break;
            }
            if (res.ok) xml = await res.text();
            else { errors.push(`BGG HTTP ${res.status} for chunk ${chunk[0]}`); bggErrors++; break; }
          } catch (e) {
            errors.push(`Fetch error: ${e instanceof Error ? e.message : String(e)}`);
            if (fetchAttempts < 3) await sleep(2000);
          }
        }

        // If we're getting auth errors, stop immediately
        if (bggErrors >= 2) {
          errors.push("Stopping: too many BGG auth errors");
          break;
        }

        if (!xml) continue;

        const parsed = parseBggXmlBatch(xml);

        const newDesignerNames = new Set<string>();
        const newArtistNames = new Set<string>();
        for (const item of parsed) {
          for (const n of item.designers) if (!designerCache.has(n)) newDesignerNames.add(n);
          for (const n of item.artists) if (!artistCache.has(n)) newArtistNames.add(n);
        }

        if (newDesignerNames.size > 0) {
          const rows = [...newDesignerNames].map(name => ({ name }));
          for (let j = 0; j < rows.length; j += 500) {
            const subBatch = rows.slice(j, j + 500);
            const { data: inserted } = await admin.from("designers")
              .upsert(subBatch, { onConflict: "name", ignoreDuplicates: true })
              .select("id, name");
            if (inserted) for (const d of inserted) designerCache.set(d.name, d.id);
          }
          const missing = [...newDesignerNames].filter(n => !designerCache.has(n));
          if (missing.length > 0) {
            const { data: existing } = await admin.from("designers").select("id, name").in("name", missing);
            if (existing) for (const d of existing) designerCache.set(d.name, d.id);
          }
        }

        if (newArtistNames.size > 0) {
          const rows = [...newArtistNames].map(name => ({ name }));
          for (let j = 0; j < rows.length; j += 500) {
            const subBatch = rows.slice(j, j + 500);
            const { data: inserted } = await admin.from("artists")
              .upsert(subBatch, { onConflict: "name", ignoreDuplicates: true })
              .select("id, name");
            if (inserted) for (const a of inserted) artistCache.set(a.name, a.id);
          }
          const missing = [...newArtistNames].filter(n => !artistCache.has(n));
          if (missing.length > 0) {
            const { data: existing } = await admin.from("artists").select("id, name").in("name", missing);
            if (existing) for (const a of existing) artistCache.set(a.name, a.id);
          }
        }

        const allDesignerJunctions: { catalog_id: string; designer_id: string }[] = [];
        const allArtistJunctions: { catalog_id: string; artist_id: string }[] = [];

        for (const item of parsed) {
          const entry = entryMap.get(item.bggId);
          if (!entry) continue;

          // Also update weight if we got better data
          const updates: Record<string, unknown> = { enriched_at: new Date().toISOString() };
          if (item.weight !== null) updates.weight = item.weight;
          await admin.from("game_catalog").update(updates).eq("id", entry.id);

          for (const name of item.designers) {
            const dId = designerCache.get(name);
            if (dId) allDesignerJunctions.push({ catalog_id: entry.id, designer_id: dId });
          }
          for (const name of item.artists) {
            const aId = artistCache.get(name);
            if (aId) allArtistJunctions.push({ catalog_id: entry.id, artist_id: aId });
          }
          processed++;
        }

        if (allDesignerJunctions.length > 0) {
          for (let j = 0; j < allDesignerJunctions.length; j += 500) {
            const batch = allDesignerJunctions.slice(j, j + 500);
            const { error: dErr } = await admin.from("catalog_designers")
              .upsert(batch, { onConflict: "catalog_id,designer_id" });
            if (dErr) errors.push(`designer junctions: ${dErr.message}`);
            else designersAdded += batch.length;
          }
        }

        if (allArtistJunctions.length > 0) {
          for (let j = 0; j < allArtistJunctions.length; j += 500) {
            const batch = allArtistJunctions.slice(j, j + 500);
            const { error: aErr } = await admin.from("catalog_artists")
              .upsert(batch, { onConflict: "catalog_id,artist_id" });
            if (aErr) errors.push(`artist junctions: ${aErr.message}`);
            else artistsAdded += batch.length;
          }
        }

        if (i + BGG_BATCH_SIZE < allBggIds.length) await sleep(1000);
      }

      return new Response(JSON.stringify({
        success: true, mode: "fix-missing", processed, designersAdded, artistsAdded,
        checked: entryIds.length, hasMore: catalogEntries.length === batchSize,
        errors: errors.slice(0, 20),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: re-enrich — Monthly refresh of weight for existing entries
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

        // BGG community ratings no longer synced to catalog
        processed++;
      }

      const hasMore = catalogEntries.length === batchSize;
      return new Response(JSON.stringify({
        success: true, mode: "sync-ratings", processed, ratingsUpdated,
        offset, nextOffset: offset + batchSize, hasMore,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: link-expansions — Link orphaned expansions to parent games
    // via title prefix matching (no BGG API calls)
    // =====================================================================
    if (mode === "link-expansions") {
      const batchSize = Math.min(body.batch_size || 500, 2000);
      const dryRun = body.dry_run === true;

      console.log(`[link-expansions] Starting (batch_size=${batchSize}, dry_run=${dryRun})`);

      const { data: expansions, error: expErr } = await admin
        .from("game_catalog")
        .select("id, title")
        .eq("is_expansion", true)
        .is("parent_catalog_id", null)
        .order("title", { ascending: true })
        .limit(batchSize);

      if (expErr) {
        return new Response(JSON.stringify({ error: expErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!expansions || expansions.length === 0) {
        return new Response(JSON.stringify({
          success: true, mode: "link-expansions", linked: 0,
          message: "No more orphaned expansions", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[link-expansions] Processing ${expansions.length} orphaned expansions`);

      // Load all base game titles into memory for matching
      const baseGameMap = new Map<string, { id: string; title: string }[]>();
      let bgOffset = 0;
      const BG_PAGE = 1000;
      while (true) {
        const { data: bgPage } = await admin
          .from("game_catalog")
          .select("id, title")
          .eq("is_expansion", false)
          .range(bgOffset, bgOffset + BG_PAGE - 1);
        if (!bgPage || bgPage.length === 0) break;
        for (const bg of bgPage) {
          const key = bg.title.toLowerCase().trim();
          if (!baseGameMap.has(key)) baseGameMap.set(key, []);
          baseGameMap.get(key)!.push(bg);
        }
        if (bgPage.length < BG_PAGE) break;
        bgOffset += BG_PAGE;
      }

      console.log(`[link-expansions] Loaded ${baseGameMap.size} unique base game titles`);

      const DELIMITERS = [": ", " – ", " — ", " - "];

      let linked = 0;
      let noMatch = 0;
      const samples: { expansion: string; parent: string }[] = [];
      const noMatchSamples: string[] = [];
      const updates: { id: string; parent_catalog_id: string }[] = [];

      for (const exp of expansions) {
        let matched = false;

        for (const delim of DELIMITERS) {
          const delimIdx = exp.title.indexOf(delim);
          if (delimIdx <= 0) continue;

          const prefix = exp.title.substring(0, delimIdx).toLowerCase().trim();
          const candidates = baseGameMap.get(prefix);

          if (candidates && candidates.length > 0) {
            const best = candidates.reduce((a, b) =>
              a.title.length <= b.title.length ? a : b
            );
            updates.push({ id: exp.id, parent_catalog_id: best.id });
            if (samples.length < 20) {
              samples.push({ expansion: exp.title, parent: best.title });
            }
            linked++;
            matched = true;
            break;
          }
        }

        if (!matched) {
          noMatch++;
          if (noMatchSamples.length < 10) noMatchSamples.push(exp.title);
        }
      }

      if (!dryRun && updates.length > 0) {
        for (let i = 0; i < updates.length; i += 200) {
          const batch = updates.slice(i, i + 200);
          const promises = batch.map(u =>
            admin.from("game_catalog")
              .update({ parent_catalog_id: u.parent_catalog_id })
              .eq("id", u.id)
          );
          await Promise.all(promises);
        }
      }

      const hasMore = expansions.length === batchSize && linked > 0;
      return new Response(JSON.stringify({
        success: true,
        mode: "link-expansions",
        dry_run: dryRun,
        linked,
        no_match: noMatch,
        total: expansions.length,
        hasMore,
        sample_links: samples,
        sample_no_match: noMatchSamples,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: classify-genres — AI-classify catalog entries into genres
    // Uses Google Gemini Flash Lite via direct API call for cost efficiency
    // =====================================================================
    if (mode === "classify-genres") {
      const genreBatchSize = Math.min(body.batch_size || 50, 100);
      const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
      if (!googleKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_AI_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const VALID_GENRES = [
        "Fantasy", "Sci-Fi", "Historical", "Horror", "Mystery", "Adventure",
        "Economic", "Abstract", "Humor", "Nature", "War", "Political",
        "Party", "Trivia", "Sports", "Educational", "Cooperative", "Other",
      ];

      const normalizeGenreKey = (value: string) =>
        value
          .toLowerCase()
          .trim()
          .replace(/['\u2019]/g, "'")
          .replace(/[^a-z0-9\s'-]/g, " ")
          .replace(/\s+/g, " ");

      // Aliases: everything funnels into the 18 valid genres
      const GENRE_ALIASES: Record<string, string> = {
        // Sci-Fi bucket
        "science fiction": "Sci-Fi", "scifi": "Sci-Fi", "sci fi": "Sci-Fi", "sci-fi": "Sci-Fi",
        "space": "Sci-Fi", "steampunk": "Sci-Fi", "cyberpunk": "Sci-Fi",
        "post-apocalyptic": "Sci-Fi", "apocalyptic": "Sci-Fi",
        // Fantasy bucket
        "mythology": "Fantasy", "myth": "Fantasy", "mythological": "Fantasy",
        "fairy tale": "Fantasy", "dungeon": "Fantasy", "magic": "Fantasy",
        "medieval": "Fantasy", "middle ages": "Fantasy", "dungeon crawler": "Fantasy",
        // Historical bucket
        "ancient": "Historical", "antiquity": "Historical", "modern": "Historical",
        "western": "Historical", "wild west": "Historical", "religious": "Historical",
        "civilization": "Historical", "civ": "Historical",
        // Horror bucket
        "zombies": "Horror", "zombie": "Horror", "undead": "Horror",
        "cthulhu": "Horror", "lovecraft": "Horror", "gothic": "Horror",
        // Mystery bucket
        "crime": "Mystery", "criminal": "Mystery", "heist": "Mystery",
        "espionage": "Mystery", "spy": "Mystery", "spies": "Mystery",
        "deduction": "Mystery", "social deduction": "Mystery",
        "detective": "Mystery", "investigation": "Mystery",
        // Adventure bucket
        "exploration": "Adventure", "explore": "Adventure", "travel": "Adventure",
        "survival": "Adventure", "pirates": "Adventure", "pirate": "Adventure",
        "nautical": "Adventure", "sailing": "Adventure",
        // Economic bucket
        "strategy": "Economic", "euro": "Economic", "resource management": "Economic",
        "industry": "Economic", "industrial": "Economic", "manufacturing": "Economic",
        "city building": "Economic", "urban": "Economic",
        "farming": "Economic", "agriculture": "Economic",
        "train": "Economic", "railroad": "Economic", "railway": "Economic",
        // Abstract bucket
        "puzzle": "Abstract", "brain teaser": "Abstract",
        "memory": "Abstract", "set collection": "Abstract",
        "word game": "Abstract", "word": "Abstract", "vocabulary": "Abstract",
        // Humor bucket
        "comedy": "Humor", "comedic": "Humor", "funny": "Humor", "humorous": "Humor",
        // Nature bucket
        "animals": "Nature", "animal": "Nature", "wildlife": "Nature",
        "dinosaur": "Nature", "fishing": "Nature",
        // War bucket
        "wargame": "War", "military": "War", "warfare": "War", "combat": "War",
        "fighting": "War", "martial arts": "War",
        "aviation": "War", "flying": "War", "aircraft": "War",
        "miniatures": "War", "minis": "War", "miniature": "War",
        // Political bucket
        "negotiation": "Political", "diplomacy": "Political",
        // Party bucket
        "party game": "Party", "party": "Party",
        "dexterity": "Party", "bluffing": "Party", "bluff": "Party", "social": "Party",
        // Trivia bucket
        "quiz": "Trivia",
        // Sports bucket
        "racing": "Sports", "race": "Sports", "sport": "Sports", "sports": "Sports",
        // Educational bucket
        "children's": "Educational", "childrens": "Educational", "children": "Educational", "kids": "Educational",
        "learning": "Educational", "educational": "Educational",
        // Cooperative bucket
        "co-op": "Cooperative", "coop": "Cooperative", "cooperative": "Cooperative",
        // Other bucket (catch-alls)
        "card game": "Other", "cards": "Other", "dice game": "Other", "dice": "Other",
        "miscellaneous": "Other", "misc": "Other", "other": "Other", "none": "Other",
      };

      // Fetch unclassified catalog entries
      const includeExpansions = body.include_expansions === true;
      let genreQuery = admin
        .from("game_catalog")
        .select("id, title, description")
        .is("genre", null)
        .not("description", "is", null)
        .order("created_at", { ascending: true })
        .limit(genreBatchSize);

      if (!includeExpansions) {
        genreQuery = genreQuery.eq("is_expansion", false);
      }

      const { data: entries, error: gFetchErr } = await genreQuery;

      if (gFetchErr) throw gFetchErr;
      if (!entries || entries.length === 0) {
        return new Response(JSON.stringify({
          success: true, mode: "classify-genres", classified: 0,
          message: "All entries classified", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let genreClassified = 0;
      const genreErrors: string[] = [];

      // Process in sub-batches of 10 for Gemini (multiple games per prompt)
      const SUB_BATCH = 10;
      for (let i = 0; i < entries.length; i += SUB_BATCH) {
        const subBatch = entries.slice(i, i + SUB_BATCH);
        
        const gamesPayload = subBatch.map((e, idx) => ({
          idx,
          title: e.title,
          desc: (e.description || "").slice(0, 500),
        }));

        const classifyPrompt = `Classify each board game into exactly ONE genre from this list: ${VALID_GENRES.join(", ")}.

IMPORTANT: Use "Other" ONLY if the game truly does not fit any other genre. Prefer a specific genre whenever possible.

Games to classify:
${gamesPayload.map(g => `[${g.idx}] "${g.title}": ${g.desc}`).join("\n\n")}

Return ONLY a JSON array of objects with "idx" and "genre" fields. The genre MUST be exactly one from the list above.
Example: [{"idx":0,"genre":"Fantasy"},{"idx":1,"genre":"Economic"}]
Do NOT include any other text.`;

        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${googleKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: classifyPrompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
              }),
            }
          );

          if (geminiRes.status === 429) {
            console.warn("[classify-genres] Rate limited, stopping batch early");
            genreErrors.push("Rate limited — stopping early");
            break;
          }

          if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            genreErrors.push(`Gemini API error ${geminiRes.status}: ${errText.slice(0, 200)}`);
            continue;
          }

          const geminiData = await geminiRes.json();
          const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          
          // Extract JSON array from response (handle markdown code blocks)
          const jsonMatch = rawText.match(/\[[\s\S]*?\]/);
          if (!jsonMatch) {
            genreErrors.push(`No JSON in response for batch starting at ${subBatch[0].title}`);
            continue;
          }

          const genreResults: { idx: number; genre: string }[] = JSON.parse(jsonMatch[0]);

          for (const result of genreResults) {
            const entry = subBatch[result.idx];
            if (!entry) continue;
            // Try exact match first, then normalized alias lookup
            const rawGenre = (result.genre || "").trim();
            const normalizedRawGenre = normalizeGenreKey(rawGenre);
            let matchedGenre = VALID_GENRES.find((g) => normalizeGenreKey(g) === normalizedRawGenre);
            if (!matchedGenre) {
              matchedGenre = GENRE_ALIASES[normalizedRawGenre] || null;
            }
            if (!matchedGenre && normalizedRawGenre.includes("'")) {
              matchedGenre = GENRE_ALIASES[normalizedRawGenre.replace(/'/g, "")] || null;
            }
            if (!matchedGenre) {
              genreErrors.push(`Invalid genre "${result.genre}" for "${entry.title}"`);
              continue;
            }

            const { error: updateErr } = await admin
              .from("game_catalog")
              .update({ genre: matchedGenre })
              .eq("id", entry.id);

            if (updateErr) {
              genreErrors.push(`Update failed for "${entry.title}": ${updateErr.message}`);
            } else {
              genreClassified++;
            }
          }
        } catch (e) {
          genreErrors.push(`Sub-batch error: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      const wasRateLimited = genreErrors.some((e) => e.toLowerCase().includes("rate limited"));
      const isStalled = genreClassified === 0;
      const genreHasMore = entries.length === genreBatchSize && (genreClassified > 0 || wasRateLimited);
      return new Response(JSON.stringify({
        success: true, mode: "classify-genres", classified: genreClassified,
        total: entries.length, hasMore: genreHasMore, stalled: isStalled,
        errors: genreErrors.slice(0, 20),
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
