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

      // Fetch all mechanics
      const mechanicCache = new Map<string, string>(); // name -> id
      let mOffset = 0;
      while (true) {
        const { data: mPage } = await admin.from("mechanics").select("id, name").range(mOffset, mOffset + D_PAGE - 1);
        if (!mPage || mPage.length === 0) break;
        for (const m of mPage) mechanicCache.set(m.name, m.id);
        if (mPage.length < D_PAGE) break;
        mOffset += D_PAGE;
      }

      console.log(`[catalog-backfill] Cached ${designerCache.size} designers, ${artistCache.size} artists, ${mechanicCache.size} mechanics`);

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
      const offset = body.offset || 0;

      console.log(`[link-expansions] Starting (batch_size=${batchSize}, dry_run=${dryRun}, offset=${offset})`);

      const { data: expansions, error: expErr } = await admin
        .from("game_catalog")
        .select("id, title")
        .eq("is_expansion", true)
        .is("parent_catalog_id", null)
        .order("title", { ascending: true })
        .range(offset, offset + batchSize - 1);

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
      // Index by full title AND by every prefix (split on delimiters)
      // so "Caverna: The Cave Farmers" is findable via "caverna" too
      const baseGameMap = new Map<string, { id: string; title: string }[]>();
      const addToMap = (key: string, bg: { id: string; title: string }) => {
        if (!baseGameMap.has(key)) baseGameMap.set(key, []);
        // Avoid duplicates
        const arr = baseGameMap.get(key)!;
        if (!arr.some(e => e.id === bg.id)) arr.push(bg);
      };
      const BG_DELIMITERS = [": ", " – ", " — ", " - "];
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
          const fullKey = bg.title.toLowerCase().trim();
          addToMap(fullKey, bg);
          // Also index by every prefix of the base game title
          for (const delim of BG_DELIMITERS) {
            let searchFrom = 0;
            while (true) {
              const idx = bg.title.indexOf(delim, searchFrom);
              if (idx <= 0) break;
              const prefix = bg.title.substring(0, idx).toLowerCase().trim();
              addToMap(prefix, bg);
              searchFrom = idx + delim.length;
            }
          }
        }
        if (bgPage.length < BG_PAGE) break;
        bgOffset += BG_PAGE;
      }

      console.log(`[link-expansions] Loaded ${baseGameMap.size} unique base game keys`);

      const DELIMITERS = [": ", " – ", " — ", " - "];

      let linked = 0;
      let noMatch = 0;
      const samples: { expansion: string; parent: string }[] = [];
      const noMatchSamples: string[] = [];
      const updates: { id: string; parent_catalog_id: string }[] = [];

      for (const exp of expansions) {
        let matched = false;

        // Collect ALL possible split points across all delimiters,
        // then try from longest prefix to shortest
        const splitPoints: number[] = [];
        for (const delim of DELIMITERS) {
          let searchFrom = 0;
          while (true) {
            const idx = exp.title.indexOf(delim, searchFrom);
            if (idx <= 0) break;
            splitPoints.push(idx);
            searchFrom = idx + delim.length;
          }
        }

        // Sort descending — try longest prefix first
        splitPoints.sort((a, b) => b - a);

        for (const splitIdx of splitPoints) {
          const prefix = exp.title.substring(0, splitIdx).toLowerCase().trim();
          const candidates = baseGameMap.get(prefix);

          if (candidates && candidates.length > 0) {
            // Prefer the best match — shortest title (most specific base game)
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

      const hasMore = expansions.length === batchSize;
      const noProgress = !dryRun && linked === 0;
      // In live mode we normally keep offset=0 so linked rows "fall out" of the first page.
      // But if a full batch links nothing, we'd keep re-reading the same 1000 rows forever.
      // In that case, advance offset to continue scanning.
      const nextOffset = (dryRun || noProgress) && hasMore ? offset + batchSize : undefined;

      return new Response(JSON.stringify({
        success: true,
        mode: "link-expansions",
        dry_run: dryRun,
        linked,
        no_match: noMatch,
        total: expansions.length,
        hasMore,
        next_offset: nextOffset,
        sample_links: samples,
        sample_no_match: noMatchSamples,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: link-expansions-bgg — Link orphaned expansions to parents
    // via BGG API parent lookup (for expansions title-matching missed)
    // =====================================================================
    if (mode === "link-expansions-bgg") {
      const batchSize = Math.min(body.batch_size || 20, 50);
      const dryRun = body.dry_run === true;
      const offset = body.offset || 0;

      console.log(`[link-expansions-bgg] Starting (batch_size=${batchSize}, dry_run=${dryRun}, offset=${offset})`);

      // Fetch orphaned expansions that have a bgg_id
      const { data: expansions, error: expErr } = await admin
        .from("game_catalog")
        .select("id, title, bgg_id")
        .eq("is_expansion", true)
        .is("parent_catalog_id", null)
        .not("bgg_id", "is", null)
        .order("title", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (expErr) {
        return new Response(JSON.stringify({ error: expErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!expansions || expansions.length === 0) {
        return new Response(JSON.stringify({
          success: true, mode: "link-expansions-bgg", linked: 0,
          message: "No more orphaned expansions with BGG IDs", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[link-expansions-bgg] Processing ${expansions.length} orphaned expansions via BGG API`);

      // Batch BGG IDs for API call (BGG supports comma-separated)
      const bggIds = expansions.map(e => e.bgg_id).join(",");
      let linked = 0;
      let noMatch = 0;
      let apiErrors = 0;
      const samples: { expansion: string; parent: string }[] = [];
      const noMatchSamples: string[] = [];

      try {
        const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggIds}&stats=1`;
        const bggHeadersNoAuth = Object.fromEntries(
          Object.entries(bggHeaders).filter(([k]) => k.toLowerCase() !== "authorization" && k.toLowerCase() !== "cookie")
        );

        let xml: string | null = null;
        let lastStatus = 0;

        // Try up to 3 times with configured headers, then 1 fallback without auth/cookie.
        for (let attempt = 1; attempt <= 4 && !xml; attempt++) {
          const headersToUse = attempt <= 3 ? bggHeaders : bggHeadersNoAuth;
          const res = await fetch(url, { headers: headersToUse });
          lastStatus = res.status;

          if (res.status === 429 || res.status === 202) {
            await sleep(attempt * 3000);
            continue;
          }

          if (res.ok) {
            xml = await res.text();
            break;
          }

          // If BGG returns unauthorized, try once without auth/cookie headers.
          if (res.status === 401 && attempt < 4) {
            continue;
          }

          break;
        }

        if (!xml) {
          return new Response(JSON.stringify({
            error: `BGG API returned ${lastStatus}`,
            mode: "link-expansions-bgg",
          }), { status: lastStatus === 429 ? 429 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (xml.includes("Please try again later") || xml.includes("<message>")) {
          return new Response(JSON.stringify({
            error: "BGG API rate limited",
            mode: "link-expansions-bgg",
            retry: true,
          }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Parse each <item> from the response
        const itemRegex = /<item[^>]*?id="(\d+)"[^>]*>[\s\S]*?<\/item>/g;
        const itemMap = new Map<string, string>();
        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
          itemMap.set(match[1], match[0]);
        }

        // Extract parent BGG IDs from inbound links
        for (const exp of expansions) {
          const itemXml = itemMap.get(exp.bgg_id!);
          if (!itemXml) {
            apiErrors++;
            continue;
          }

          // Find all inbound expansion links (these point to parent games)
          const parentBggIds: string[] = [];
          const linkRegex = /<link[^>]*type="boardgameexpansion"[^>]*id="(\d+)"[^>]*inbound="true"[^>]*\/?>/g;
          const linkRegex2 = /<link[^>]*inbound="true"[^>]*type="boardgameexpansion"[^>]*id="(\d+)"[^>]*\/?>/g;
          let linkMatch;
          while ((linkMatch = linkRegex.exec(itemXml)) !== null) {
            parentBggIds.push(linkMatch[1]);
          }
          if (parentBggIds.length === 0) {
            while ((linkMatch = linkRegex2.exec(itemXml)) !== null) {
              parentBggIds.push(linkMatch[1]);
            }
          }

          if (parentBggIds.length === 0) {
            noMatch++;
            if (noMatchSamples.length < 10) noMatchSamples.push(exp.title);
            continue;
          }

          // Find parent in catalog by bgg_id
          let parentFound = false;
          for (const parentBggId of parentBggIds) {
            const { data: parentCatalog } = await admin
              .from("game_catalog")
              .select("id, title")
              .eq("bgg_id", parentBggId)
              .eq("is_expansion", false)
              .maybeSingle();

            if (parentCatalog) {
              if (!dryRun) {
                await admin
                  .from("game_catalog")
                  .update({ parent_catalog_id: parentCatalog.id })
                  .eq("id", exp.id);
              }
              linked++;
              if (samples.length < 20) {
                samples.push({ expansion: exp.title, parent: parentCatalog.title });
              }
              parentFound = true;
              break;
            }
          }

          if (!parentFound) {
            noMatch++;
            if (noMatchSamples.length < 10) noMatchSamples.push(exp.title);
          }
        }
      } catch (err) {
        console.error(`[link-expansions-bgg] BGG fetch error:`, err);
        return new Response(JSON.stringify({
          error: String(err),
          mode: "link-expansions-bgg",
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const hasMore = expansions.length === batchSize;
      const unresolvedCount = noMatch + apiErrors;
      // In live mode, linked rows disappear from the query result set, so only
      // advance past unresolved rows to avoid reprocessing the same no-match items.
      const nextOffset = hasMore
        ? dryRun
          ? offset + batchSize
          : offset + unresolvedCount
        : undefined;

      return new Response(JSON.stringify({
        success: true,
        mode: "link-expansions-bgg",
        dry_run: dryRun,
        linked,
        no_match: noMatch,
        api_errors: apiErrors,
        total: expansions.length,
        hasMore,
        next_offset: nextOffset,
        sample_links: samples,
        sample_no_match: noMatchSamples,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: classify-genres — AI-classify catalog entries into genres
    // Uses self-hosted Cortex at https://cortex.tzolak.com/api/classify-genre
    // =====================================================================
    if (mode === "classify-genres") {
      const CORTEX_URL = "https://cortex.tzolak.com/api/classify-genre";
      const genreBatchSize = Math.min(body.batch_size || 50, 200);
      const SUB_BATCH = Math.min(body.sub_batch_size || 6, 10);
      const CORTEX_TIMEOUT_MS = Math.min(Math.max(body.cortex_timeout_ms || 6000, 3000), 12000);
      const SINGLE_ITEM_TIMEOUT_MS = Math.min(Math.max(body.single_item_timeout_ms || 2500, 1500), 6000);
      const MAX_CORTEX_RETRIES = 2;

      const VALID_GENRES = [
        "Fantasy", "Sci-Fi", "Historical", "Horror", "Mystery", "Adventure",
        "Strategy", "Abstract", "Humor", "Nature", "War", "Political",
        "Party", "Trivia", "Sports", "Educational", "Cooperative", "Family",
        "Deck Building", "Other",
      ];

      // Map legacy genres to new taxonomy
      const GENRE_ALIASES: Record<string, string> = {
        "Economic": "Strategy",
      };

      const heuristicGenreRules: Array<{ genre: string; keywords: string[] }> = [
        { genre: "Fantasy", keywords: ["fantasy", "dragon", "wizard", "magic", "orc", "elf", "dungeon"] },
        { genre: "Sci-Fi", keywords: ["sci-fi", "science fiction", "space", "alien", "galaxy", "robot", "cyber"] },
        { genre: "Historical", keywords: ["historical", "history", "medieval", "renaissance", "ancient", "victorian"] },
        { genre: "Horror", keywords: ["horror", "zombie", "vampire", "monster", "haunted", "terror", "eldritch"] },
        { genre: "Mystery", keywords: ["mystery", "detective", "murder", "investigation", "whodunit", "crime"] },
        { genre: "Adventure", keywords: ["adventure", "explore", "exploration", "journey", "expedition", "quest"] },
        { genre: "War", keywords: ["war", "battle", "military", "combat", "army", "naval", "wwii"] },
        { genre: "Political", keywords: ["politic", "election", "government", "senate", "diplomacy", "negotiation"] },
        { genre: "Party", keywords: ["party", "charades", "social", "laugh", "drawing", "guessing"] },
        { genre: "Trivia", keywords: ["trivia", "quiz", "knowledge", "facts"] },
        { genre: "Sports", keywords: ["sports", "soccer", "football", "baseball", "basketball", "racing"] },
        { genre: "Educational", keywords: ["educational", "learn", "teaching", "math", "spelling", "science"] },
        { genre: "Nature", keywords: ["nature", "animal", "wildlife", "forest", "ocean", "ecosystem"] },
        { genre: "Humor", keywords: ["humor", "funny", "comedy", "joke", "silly"] },
        { genre: "Deck Building", keywords: ["deck building", "deckbuilder", "cards in deck", "card drafting"] },
        { genre: "Cooperative", keywords: ["cooperative", "co-op", "team up", "work together"] },
        { genre: "Family", keywords: ["family", "kids", "children", "all ages"] },
        { genre: "Abstract", keywords: ["abstract", "pattern", "spatial", "tile placement"] },
        { genre: "Strategy", keywords: ["strategy", "economic", "engine building", "resource management", "area control"] },
      ];

      const classifyGenresHeuristically = (entry: any, mechanics: string[] = []) => {
        const corpus = `${entry.title || ""} ${entry.description || ""} ${mechanics.join(" ")}`.toLowerCase();
        const matches = heuristicGenreRules
          .filter(({ keywords }) => keywords.some((keyword) => corpus.includes(keyword)))
          .map(({ genre }) => genre);

        if (matches.length === 0) return ["Other"];
        return [...new Set(matches)].slice(0, 3);
      };

      const normalizeGenreResults = (cortexData: any) => {
        const results: { id: string; genres?: string[]; genre?: string }[] = cortexData?.classified || [];
        if (!cortexData?.classified && cortexData?.id && (cortexData?.genres || cortexData?.genre)) {
          results.push(cortexData);
        }
        return results;
      };

      const callCortex = async (
        payload: Array<{ id: string; title: string; description: string; mechanics: string[] }>,
        timeoutMs: number,
        retries: number,
      ) => {
        let lastError = "Unknown Cortex error";

        for (let attempt = 1; attempt <= retries; attempt++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort("cortex-timeout"), timeoutMs);

          try {
            const cortexRes = await fetch(CORTEX_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });

            if (cortexRes.status === 429) {
              await cortexRes.text();
              return { results: [], error: "Rate limited — stopping early", rateLimited: true };
            }

            if (cortexRes.status === 502 || cortexRes.status === 503 || cortexRes.status === 504) {
              const errText = await cortexRes.text();
              lastError = `Cortex API error ${cortexRes.status}: ${errText.slice(0, 200)}`;
              console.warn(`[classify-genres] Cortex ${cortexRes.status}, attempt ${attempt}/${retries}, payload=${payload.length}`);
              if (attempt < retries) {
                await sleep(attempt * 1000);
                continue;
              }
            } else if (!cortexRes.ok) {
              const errText = await cortexRes.text();
              lastError = `Cortex API error ${cortexRes.status}: ${errText.slice(0, 200)}`;
            } else {
              const cortexData = await cortexRes.json();
              return {
                results: normalizeGenreResults(cortexData),
                error: null,
                rateLimited: false,
              };
            }
          } catch (fetchErr) {
            const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            const timedOut = fetchErr instanceof Error && errMsg.toLowerCase().includes("abort");
            lastError = timedOut ? `Cortex timeout after ${timeoutMs}ms` : `Cortex connection failed: ${errMsg}`;
            console.warn(`[classify-genres] Cortex fetch error, attempt ${attempt}/${retries}, payload=${payload.length}:`, fetchErr);
            if (attempt < retries) {
              await sleep(attempt * 1000);
              continue;
            }
          } finally {
            clearTimeout(timeoutId);
          }
        }

        return { results: [], error: lastError, rateLimited: false };
      };

      // Fetch unclassified catalog entries (those without any catalog_genres rows)
      const includeExpansions = body.include_expansions === true;

      // Use a database-level approach to find unclassified entries
      let entries: any[] = [];
      const { data: rpcData, error: gFetchErr } = await admin.rpc("get_catalog_entries_without_genres", {
        p_limit: genreBatchSize,
        p_include_expansions: includeExpansions,
      });

      if (gFetchErr) {
        // Fallback: paginated JS filtering if RPC doesn't exist yet
        console.warn("[classify-genres] RPC fallback:", gFetchErr.message);
        const PAGE_SIZE = 1000;
        let offset = 0;
        let filteredEntries: any[] = [];
        
        while (filteredEntries.length < genreBatchSize) {
          let q = admin
            .from("game_catalog")
            .select("id, title, description")
            .not("description", "is", null)
            .order("created_at", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
          if (!includeExpansions) q = q.eq("is_expansion", false);
          
          const { data: page, error: pageErr } = await q;
          if (pageErr) throw pageErr;
          if (!page || page.length === 0) break;
          
          const ids = page.map((e: any) => e.id);
          const { data: existing } = await admin
            .from("catalog_genres")
            .select("catalog_id")
            .in("catalog_id", ids);
          const hasGenres = new Set((existing || []).map((r: any) => r.catalog_id));
          const unclassified = page.filter((e: any) => !hasGenres.has(e.id));
          filteredEntries.push(...unclassified);
          
          offset += PAGE_SIZE;
          if (page.length < PAGE_SIZE) break;
        }
        entries = filteredEntries.slice(0, genreBatchSize);
      } else {
        entries = rpcData || [];
      }

      if (!entries || entries.length === 0) {
        return new Response(JSON.stringify({
          success: true, mode: "classify-genres", classified: 0,
          message: "All entries classified", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch existing mechanics for these entries to enrich Cortex input
      const catalogIds = entries.map((e: any) => e.id);
      const { data: mechRows } = await admin
        .from("catalog_mechanics")
        .select("catalog_id, mechanic_id")
        .in("catalog_id", catalogIds);

      // Resolve mechanic IDs to names
      let mechNameMap: Record<string, string> = {};
      if (mechRows && mechRows.length > 0) {
        const mechIds = [...new Set(mechRows.map((r: any) => r.mechanic_id))];
        const { data: mechs } = await admin
          .from("mechanics")
          .select("id, name")
          .in("id", mechIds);
        if (mechs) {
          for (const m of mechs) mechNameMap[m.id] = m.name;
        }
      }

      // Build per-catalog mechanic lists
      const catalogMechanics: Record<string, string[]> = {};
      if (mechRows) {
        for (const r of mechRows as any[]) {
          const name = mechNameMap[r.mechanic_id];
          if (name) {
            if (!catalogMechanics[r.catalog_id]) catalogMechanics[r.catalog_id] = [];
            catalogMechanics[r.catalog_id].push(name);
          }
        }
      }

      let genreClassified = 0;
      const genreErrors: string[] = [];

      for (let i = 0; i < entries.length; i += SUB_BATCH) {
        const subBatch = entries.slice(i, i + SUB_BATCH);

        const cortexPayload = subBatch.map((e: any) => ({
          id: e.id,
          title: e.title,
          description: (e.description || "").slice(0, 500),
          mechanics: catalogMechanics[e.id] || [],
        }));

        try {
          const batchResponse = await callCortex(cortexPayload, CORTEX_TIMEOUT_MS, MAX_CORTEX_RETRIES);
          let results = batchResponse.results;

          if (batchResponse.rateLimited) {
            console.warn("[classify-genres] Cortex rate limited, stopping batch early");
            genreErrors.push(batchResponse.error || "Rate limited — stopping early");
            break;
          }

          if (batchResponse.error) {
            console.warn(`[classify-genres] Falling back to single-item mode for ${subBatch.length} entries: ${batchResponse.error}`);
            genreErrors.push(`Sub-batch fallback (${subBatch.length} entries): ${batchResponse.error}`);
            results = [];

            for (const entry of subBatch) {
              const singlePayload = [{
                id: entry.id,
                title: entry.title,
                description: (entry.description || "").slice(0, 500),
                mechanics: catalogMechanics[entry.id] || [],
              }];

              const singleResponse = await callCortex(singlePayload, SINGLE_ITEM_TIMEOUT_MS, 1);

              if (singleResponse.rateLimited) {
                genreErrors.push(singleResponse.error || `Rate limited while classifying ${entry.title}`);
                break;
              }

              if (singleResponse.results.length > 0) {
                results.push(...singleResponse.results);
                continue;
              }

              const fallbackGenres = classifyGenresHeuristically(entry, catalogMechanics[entry.id] || []);
              results.push({ id: entry.id, genres: fallbackGenres });
              genreErrors.push(`Used heuristic fallback for "${entry.title}": ${singleResponse.error || batchResponse.error}`);
            }
          }

          for (const result of results) {
            // Normalize: support both `genres` array and legacy `genre` string
            const rawGenres: string[] = result.genres
              ? result.genres.slice(0, 3)
              : result.genre ? [result.genre] : [];

            if (rawGenres.length === 0) continue;

            // Validate and map each genre
            const validGenres: string[] = [];
            for (const rawGenre of rawGenres) {
              const trimmed = (rawGenre || "").trim();
              const aliased = GENRE_ALIASES[trimmed] || trimmed;
              const matched = VALID_GENRES.find(
                (g) => g.toLowerCase() === aliased.toLowerCase()
              );
              if (matched) {
                // Deduplicate (e.g. if alias maps to something already in the list)
                if (!validGenres.includes(matched)) validGenres.push(matched);
              } else {
                const entry = subBatch.find((e: any) => e.id === result.id);
                genreErrors.push(`Invalid genre "${trimmed}" for "${entry?.title || result.id}"`);
              }
            }

            if (validGenres.length === 0) continue;

            // Delete existing genres for this catalog entry (clean re-classification)
            await admin.from("catalog_genres").delete().eq("catalog_id", result.id);

            // Insert new genres with display_order
            const genreRows = validGenres.map((genre, idx) => ({
              catalog_id: result.id,
              genre,
              display_order: idx,
            }));

            const { error: insertErr } = await admin
              .from("catalog_genres")
              .insert(genreRows);

            if (insertErr) {
              genreErrors.push(`Insert failed for ${result.id}: ${insertErr.message}`);
            } else {
              // Also update the legacy genre column with the primary genre
              await admin.from("game_catalog").update({ genre: validGenres[0] }).eq("id", result.id);
              genreClassified++;
            }
          }
        } catch (e) {
          genreErrors.push(`Sub-batch error: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      const wasRateLimited = genreErrors.some((e) => e.toLowerCase().includes("rate limited"));
      const hadErrors = genreErrors.length > 0;
      // Keep going if: we classified some, OR we had retryable errors (entries still unclassified), OR rate limited
      const genreHasMore = entries.length > 0 && (genreClassified > 0 || wasRateLimited || hadErrors);
      return new Response(JSON.stringify({
        success: true, mode: "classify-genres", classified: genreClassified,
        total: entries.length, hasMore: genreHasMore,
        errors: genreErrors.slice(0, 20),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: classify-mechanics — AI-classify catalog entries into mechanic families
    // Uses Google Gemini Flash Lite to suggest mechanic families based on title/description
    // Then maps to actual mechanic IDs via mechanic_families -> mechanics
    // =====================================================================
    if (mode === "classify-mechanics") {
      const mechBatchSize = Math.min(body.batch_size || 30, 80);
      const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
      if (!googleKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_AI_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load all mechanic families and their child mechanic IDs
      const familyNameToChildIds = new Map<string, string[]>();
      const familyNames: string[] = [];
      let mfOffset = 0;
      const MF_PAGE = 100;
      while (true) {
        const { data: mfPage } = await admin.from("mechanic_families").select("id, name").range(mfOffset, mfOffset + MF_PAGE - 1);
        if (!mfPage || mfPage.length === 0) break;
        for (const mf of mfPage) {
          familyNames.push(mf.name);
          familyNameToChildIds.set(mf.name.toLowerCase(), []);
        }
        if (mfPage.length < MF_PAGE) break;
        mfOffset += MF_PAGE;
      }

      // Load all mechanics with their family mapping
      let mecOffset = 0;
      const MEC_PAGE = 1000;
      while (true) {
        const { data: mecPage } = await admin.from("mechanics").select("id, name, family_id, mechanic_families(name)").range(mecOffset, mecOffset + MEC_PAGE - 1);
        if (!mecPage || mecPage.length === 0) break;
        for (const m of mecPage) {
          const familyName = (m as any).mechanic_families?.name;
          if (familyName) {
            const key = familyName.toLowerCase();
            const arr = familyNameToChildIds.get(key);
            if (arr) arr.push(m.id);
          }
        }
        if (mecPage.length < MEC_PAGE) break;
        mecOffset += MEC_PAGE;
      }

      console.log(`[classify-mechanics] Loaded ${familyNames.length} families, mapping to child mechanic IDs`);

      // Fetch catalog entries that have NO mechanics assigned (neither catalog_mechanics nor existing BGG data)
      // We target games missing from catalog_mechanics entirely
      const { data: entries, error: mFetchErr } = await admin
        .rpc("get_catalog_entries_without_mechanics", { p_limit: mechBatchSize });

      // Fallback if RPC doesn't exist
      let entriesToProcess = entries;
      if (mFetchErr) {
        console.warn("[classify-mechanics] RPC not found, using inline query");
        const { data: fallbackEntries, error: fbErr } = await admin
          .from("game_catalog")
          .select("id, title, description")
          .eq("is_expansion", false)
          .not("description", "is", null)
          .order("created_at", { ascending: true })
          .limit(mechBatchSize);

        if (fbErr) throw fbErr;

        // Filter out ones that already have catalog_mechanics
        if (fallbackEntries && fallbackEntries.length > 0) {
          const ids = fallbackEntries.map((e: any) => e.id);
          const { data: existingMechs } = await admin
            .from("catalog_mechanics")
            .select("catalog_id")
            .in("catalog_id", ids);
          const hasIds = new Set((existingMechs || []).map((r: any) => r.catalog_id));
          entriesToProcess = fallbackEntries.filter((e: any) => !hasIds.has(e.id));
        } else {
          entriesToProcess = [];
        }
      }

      if (!entriesToProcess || entriesToProcess.length === 0) {
        return new Response(JSON.stringify({
          success: true, mode: "classify-mechanics", classified: 0,
          message: "All entries have mechanics assigned", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[classify-mechanics] Processing ${entriesToProcess.length} entries`);

      let mechClassified = 0;
      let mechInserted = 0;
      const mechErrors: string[] = [];

      // Process in sub-batches of 8 for Gemini
      const MECH_SUB_BATCH = 8;
      for (let i = 0; i < entriesToProcess.length; i += MECH_SUB_BATCH) {
        const subBatch = entriesToProcess.slice(i, i + MECH_SUB_BATCH);

        const gamesPayload = subBatch.map((e: any, idx: number) => ({
          idx,
          title: e.title,
          desc: (e.description || "").slice(0, 600),
        }));

        const classifyPrompt = `You are a board game expert. For each game below, assign 2-5 mechanic families from this list:
${familyNames.join(", ")}

Rules:
- Choose ONLY from the list above. Do NOT invent new families.
- Assign 2-5 families per game based on its primary gameplay mechanics.
- If a game is about managing resources (food, wood, money, etc.), include "Resource Management".
- If players place workers/meeples to take actions, include "Worker Placement".
- If players build a personal tableau or engine, include "Engine Building".
- Be generous — if a mechanic is a significant part of gameplay, include it.
- "Miscellaneous" should only be used if the game truly doesn't fit any other family.

Games to classify:
${gamesPayload.map(g => `[${g.idx}] "${g.title}": ${g.desc}`).join("\n\n")}

Return ONLY a JSON array: [{"idx":0,"families":["Worker Placement","Resource Management"]},...]
Do NOT include any other text.`;

        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${googleKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: classifyPrompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
              }),
            }
          );

          if (geminiRes.status === 429) {
            console.warn("[classify-mechanics] Rate limited, stopping batch early");
            mechErrors.push("Rate limited — stopping early");
            break;
          }

          if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            mechErrors.push(`Gemini API error ${geminiRes.status}: ${errText.slice(0, 200)}`);
            continue;
          }

          const geminiData = await geminiRes.json();
          const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

          const jsonMatch = rawText.match(/\[[\s\S]*?\]/);
          if (!jsonMatch) {
            mechErrors.push(`No JSON in response for batch starting at ${subBatch[0].title}`);
            continue;
          }

          const mechResults: { idx: number; families: string[] }[] = JSON.parse(jsonMatch[0]);

          for (const result of mechResults) {
            const entry = subBatch[result.idx];
            if (!entry) continue;

            const junctionsToInsert: { catalog_id: string; mechanic_id: string }[] = [];

            for (const familyName of (result.families || [])) {
              const key = familyName.toLowerCase().trim();
              const childIds = familyNameToChildIds.get(key);
              if (childIds && childIds.length > 0) {
                // Insert the FIRST child mechanic from this family as representative
                // This links the game to the family via the mechanic->family relationship
                junctionsToInsert.push({ catalog_id: entry.id, mechanic_id: childIds[0] });
              } else {
                mechErrors.push(`Unknown family "${familyName}" for "${entry.title}"`);
              }
            }

            if (junctionsToInsert.length > 0) {
              const { error: insertErr } = await admin
                .from("catalog_mechanics")
                .upsert(junctionsToInsert, { onConflict: "catalog_id,mechanic_id" });
              if (insertErr) {
                mechErrors.push(`Insert failed for "${entry.title}": ${insertErr.message}`);
              } else {
                mechClassified++;
                mechInserted += junctionsToInsert.length;
              }
            }
          }
        } catch (e) {
          mechErrors.push(`Sub-batch error: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      const wasRateLimited = mechErrors.some(e => e.toLowerCase().includes("rate limited"));
      const mechHasMore = entriesToProcess.length === mechBatchSize && (mechClassified > 0 || wasRateLimited);
      return new Response(JSON.stringify({
        success: true, mode: "classify-mechanics", classified: mechClassified,
        mechanics_inserted: mechInserted,
        total: entriesToProcess.length, hasMore: mechHasMore,
        errors: mechErrors.slice(0, 20),
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
