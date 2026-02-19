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

function parseBggXml(xml: string) {
  const mechanicsMatches = xml.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]+)"/g);
  const mechanics = [...mechanicsMatches].map((m) => decodeHtmlEntities(m[1]));
  const publisherMatch = xml.match(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]+)"/);
  const designerMatches = xml.matchAll(/<link[^>]*type="boardgamedesigner"[^>]*value="([^"]+)"/g);
  const designers = [...designerMatches].map((m) => decodeHtmlEntities(m[1]));
  const artistMatches = xml.matchAll(/<link[^>]*type="boardgameartist"[^>]*value="([^"]+)"/g);
  const artists = [...artistMatches].map((m) => decodeHtmlEntities(m[1]));
  const descMatch = xml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  const description = descMatch?.[1] ? decodeHtmlEntities(descMatch[1]).trim().slice(0, 5000) : undefined;

  // Extract BGG community average rating (10-point scale)
  const ratingMatch = xml.match(/<average\s+value="([^"]+)"/);
  const bggRating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
  const bggCommunityRating = bggRating && !isNaN(bggRating) && bggRating > 0
    ? Math.round(bggRating * 10) / 10  // Keep original 10-point scale with 1 decimal
    : null;

  // Extract weight
  const weightMatch = xml.match(/<averageweight\s+value="([^"]+)"/);
  const weight = weightMatch ? parseFloat(weightMatch[1]) : null;
  const parsedWeight = weight && !isNaN(weight) && weight > 0 ? Math.round(weight * 100) / 100 : null;

  return {
    mechanics,
    publisher: publisherMatch?.[1] ? decodeHtmlEntities(publisherMatch[1]) : undefined,
    designers,
    artists,
    description,
    bggCommunityRating,
    weight: parsedWeight,
  };
}

async function upsertDesignersByName(admin: ReturnType<typeof createClient>, names: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const { data: existing } = await admin.from("designers").select("id").eq("name", name).maybeSingle();
    if (existing?.id) { ids.push(existing.id); continue; }
    const { data: inserted } = await admin.from("designers").upsert({ name }, { onConflict: "name" }).select("id").single();
    if (inserted?.id) ids.push(inserted.id);
  }
  return ids;
}

async function upsertArtistsByName(admin: ReturnType<typeof createClient>, names: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const { data: existing } = await admin.from("artists").select("id").eq("name", name).maybeSingle();
    if (existing?.id) { ids.push(existing.id); continue; }
    const { data: inserted } = await admin.from("artists").upsert({ name }, { onConflict: "name" }).select("id").single();
    if (inserted?.id) ids.push(inserted.id);
  }
  return ids;
}

/**
 * Catalog Backfill — populates game_catalog with designers, artists,
 * and enriched descriptions from existing games with bgg_id.
 *
 * Modes:
 * - default: Link unlinked games to catalog entries
 * - enrich: Re-fetch BGG XML to add designers/artists (processes batch_size entries per call)
 *
 * Params: { mode, batch_size (default 5), offset (default 0) }
 */
const handler = async (req: Request): Promise<Response> => {
  console.log("[catalog-backfill] Handler invoked", req.method);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("[catalog-backfill] No auth header");
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    console.log("[catalog-backfill] Env loaded, URL:", supabaseUrl ? "set" : "MISSING", "serviceKey:", serviceKey ? "set" : "MISSING");

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      console.log("[catalog-backfill] Auth failed:", userErr?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[catalog-backfill] User authenticated:", user.id);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleData } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      console.log("[catalog-backfill] Not admin");
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "default";
    const batchSize = Math.min(body.batch_size || 5, 10);
    const offset = body.offset || 0;
    console.log("[catalog-backfill] Mode:", mode, "batchSize:", batchSize, "offset:", offset);

    // =====================================================================
    // MODE: status — Return enrichment progress counts
    // =====================================================================
    if (mode === "status") {
      // Total catalog entries with bgg_id (enrichable)
      const { count: totalWithBgg } = await admin
        .from("game_catalog")
        .select("id", { count: "exact", head: true })
        .not("bgg_id", "is", null);

      // Entries that have at least one designer OR one artist (enriched with metadata)
      // Use a raw approach: count distinct catalog_ids in both junction tables
      const { data: designerCatalogIds } = await admin
        .from("catalog_designers")
        .select("catalog_id");
      const { data: artistCatalogIds } = await admin
        .from("catalog_artists")
        .select("catalog_id");

      const designerSet = new Set((designerCatalogIds || []).map(r => r.catalog_id));
      const artistSet = new Set((artistCatalogIds || []).map(r => r.catalog_id));
      
      // Entries with designers OR artists (union — many BGG games have no artist listed)
      const enrichedSet = new Set([...designerSet, ...artistSet]);
      const enrichedCount = enrichedSet.size;

      // Entries with rating
      const { count: withRating } = await admin
        .from("game_catalog")
        .select("id", { count: "exact", head: true })
        .not("bgg_id", "is", null)
        .not("bgg_community_rating", "is", null)
        .gt("bgg_community_rating", 0);

      return new Response(JSON.stringify({
        total_with_bgg: totalWithBgg || 0,
        enriched: enrichedCount,
        has_designers: designerSet.size,
        has_artists: artistSet.size,
        has_rating: withRating || 0,
        remaining: (totalWithBgg || 0) - enrichedCount,
        percent: totalWithBgg ? Math.round((enrichedCount / totalWithBgg) * 100) : 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: enrich — Re-fetch BGG XML for catalog entries to add designers/artists
    // =====================================================================
    // MODE: test — single BGG fetch diagnostic
    if (mode === "test") {
      const testBggId = body.bgg_id || "174430"; // default: Gloomhaven
      const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${testBggId}&stats=1`;
      const bggApiToken = Deno.env.get("BGG_API_TOKEN") || "";
      const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
      const testHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/xml",
        Referer: "https://boardgamegeek.com/",
        Origin: "https://boardgamegeek.com",
      };
      if (bggApiToken) testHeaders["Authorization"] = `Bearer ${bggApiToken}`;
      if (bggCookie) testHeaders["Cookie"] = bggCookie;
      console.log("[catalog-backfill] TEST mode, fetching:", xmlUrl, "hasToken:", !!bggApiToken, "hasCookie:", !!bggCookie);
      try {
        const res = await fetch(xmlUrl, { headers: testHeaders });
        const status = res.status;
        const text = await res.text();
        const hasItem = text.includes("<item");
        let parsed = null;
        if (hasItem) parsed = parseBggXml(text);
        return new Response(JSON.stringify({
          success: true, mode: "test", bgg_id: testBggId,
          http_status: status, response_length: text.length,
          has_item_data: hasItem,
          parsed_preview: parsed ? {
            designers: parsed.designers.length,
            artists: parsed.artists.length,
            rating: parsed.bggCommunityRating,
            weight: parsed.weight,
            description_length: parsed.description?.length || 0,
          } : null,
          raw_preview: text.slice(0, 500),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false, mode: "test", bgg_id: testBggId,
          error: e instanceof Error ? e.message : String(e),
          error_type: e instanceof Error ? e.constructor.name : typeof e,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Build BGG auth headers once for all fetches
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
    console.log("[catalog-backfill] BGG auth - hasToken:", !!bggApiToken, "hasCookie:", !!bggCookie);

    if (mode === "enrich") {
      // Use efficient DB function that LEFT JOINs to find entries missing designers
      const { data: catalogEntries, error: catErr } = await admin
        .rpc("get_unenriched_catalog_entries", { p_limit: batchSize });

      if (catErr) {
        console.error("[catalog-backfill] RPC error:", catErr.message);
        return new Response(JSON.stringify({ error: catErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[catalog-backfill] Found", catalogEntries?.length || 0, "unenriched catalog entries");

      if (!catalogEntries || catalogEntries.length === 0) {
        return new Response(JSON.stringify({
          success: true, processed: 0, designersAdded: 0, artistsAdded: 0,
          message: "No more catalog entries to process", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let processed = 0;
      let designersAdded = 0;
      let artistsAdded = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const entry of catalogEntries) {
        try {
          console.log("[catalog-backfill] Processing:", entry.title, "bgg_id:", entry.bgg_id);

          // Fetch BGG XML with retry
          const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${entry.bgg_id}&stats=1`;
          let res: Response | null = null;
          let fetchAttempts = 0;
          const maxAttempts = 3;

          while (fetchAttempts < maxAttempts) {
            fetchAttempts++;
            try {
              res = await fetch(xmlUrl, { headers: bggHeaders });

              if (res.status === 429) {
                const waitMs = fetchAttempts * 2000; // 2s, 4s, 6s
                errors.push(`${entry.title}: Rate limited (429), retry ${fetchAttempts}/${maxAttempts}, waiting ${waitMs}ms`);
                await sleep(waitMs);
                res = null;
                continue;
              }

              if (res.status === 202) {
                // BGG returns 202 when data is being prepared
                errors.push(`${entry.title}: BGG returned 202 (queued), retry ${fetchAttempts}/${maxAttempts}`);
                await sleep(3000);
                res = null;
                continue;
              }

              break; // Success or non-retryable error
            } catch (fetchErr) {
              errors.push(`${entry.title}: Fetch error attempt ${fetchAttempts}: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
              if (fetchAttempts < maxAttempts) await sleep(2000);
            }
          }

          if (!res) {
            errors.push(`${entry.title}: All ${maxAttempts} fetch attempts failed`);
            continue;
          }

          if (!res.ok) {
            errors.push(`${entry.title}: HTTP ${res.status}`);
            continue;
          }

          const xml = await res.text();
          if (!xml.includes("<item")) {
            errors.push(`${entry.title}: No item data in response (${xml.length} chars)`);
            continue;
          }

          const parsed = parseBggXml(xml);
          console.log("[catalog-backfill]", entry.title, "=> designers:", parsed.designers.length, "artists:", parsed.artists.length, "rating:", parsed.bggCommunityRating, "weight:", parsed.weight);

          // Update catalog entry with BGG community rating and weight if available
          const catalogUpdate: Record<string, unknown> = {};
          if (parsed.bggCommunityRating !== null) catalogUpdate.bgg_community_rating = parsed.bggCommunityRating;
          if (parsed.weight !== null) catalogUpdate.weight = parsed.weight;
          if (parsed.description) catalogUpdate.description = parsed.description;
          if (Object.keys(catalogUpdate).length > 0) {
            await admin.from("game_catalog").update(catalogUpdate).eq("id", entry.id);
          }

          // Upsert designers
          const designerIds = await upsertDesignersByName(admin, parsed.designers);
          for (const designerId of designerIds) {
            await admin.from("catalog_designers").upsert(
              { catalog_id: entry.id, designer_id: designerId },
              { onConflict: "catalog_id,designer_id" }
            );
            designersAdded++;
          }

          // Upsert artists
          const artistIds = await upsertArtistsByName(admin, parsed.artists);
          for (const artistId of artistIds) {
            await admin.from("catalog_artists").upsert(
              { catalog_id: entry.id, artist_id: artistId },
              { onConflict: "catalog_id,artist_id" }
            );
            artistsAdded++;
          }

          // Also backfill game_designers/game_artists for linked games
          const { data: linkedGames } = await admin.from("games").select("id").eq("catalog_id", entry.id);
          if (linkedGames) {
            for (const game of linkedGames) {
              for (const dId of designerIds) {
                await admin.from("game_designers").upsert(
                  { game_id: game.id, designer_id: dId },
                  { onConflict: "game_id,designer_id" }
                );
              }
              for (const aId of artistIds) {
                await admin.from("game_artists").upsert(
                  { game_id: game.id, artist_id: aId },
                  { onConflict: "game_id,artist_id" }
                );
              }
            }
          }

          processed++;
          // Rate-limit pause between BGG requests
          await sleep(500);
        } catch (e) {
          errors.push(`${entry.title}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      const hasMore = catalogEntries.length === batchSize;

      return new Response(JSON.stringify({
        success: true, mode: "enrich", processed, skipped, designersAdded, artistsAdded,
        total: catalogEntries.length, offset, nextOffset: offset + batchSize,
        hasMore, errors: errors.slice(0, 20),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // MODE: sync-ratings — Aggregate user ratings from libraries into catalog
    // =====================================================================
    if (mode === "sync-ratings") {
      // Get catalog entries with linked games, in batches
      const { data: catalogEntries, error: catErr } = await admin
        .from("game_catalog")
        .select("id")
        .order("title")
        .range(offset, offset + batchSize - 1);

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
        // Find all games linked to this catalog entry
        const { data: linkedGames } = await admin.from("games").select("id").eq("catalog_id", entry.id);
        if (!linkedGames || linkedGames.length === 0) continue;

        const gameIds = linkedGames.map(g => g.id);
        // Get all non-bgg-community ratings for these games
        const { data: ratings } = await admin
          .from("game_ratings")
          .select("rating")
          .in("game_id", gameIds)
          .neq("guest_identifier", "bgg-community");

        if (ratings && ratings.length > 0) {
          const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
          // Store as community_rating (separate from bgg_community_rating which comes from BGG)
          // For now, we don't have a separate column, so we'll skip if bgg_community_rating already exists
        }

        // Also check if bgg_community_rating is missing but we have bgg-community entries in game_ratings
        const { data: bggRatings } = await admin
          .from("game_ratings")
          .select("rating")
          .in("game_id", gameIds)
          .eq("guest_identifier", "bgg-community")
          .limit(1);

        if (bggRatings && bggRatings.length > 0) {
          // Convert 5-star back to 10-point for catalog display
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
          bgg_id: bggId,
          title: firstGame.title,
          image_url: firstGame.image_url || null,
          description: firstGame.description?.slice(0, 10000) || null,
          min_players: firstGame.min_players || null,
          max_players: firstGame.max_players || null,
          play_time_minutes: firstGame.play_time ? timeMap[firstGame.play_time] || null : null,
          weight: firstGame.difficulty ? weightMap[firstGame.difficulty] || null : null,
          suggested_age: firstGame.suggested_age || null,
          is_expansion: firstGame.is_expansion === true,
          bgg_url: firstGame.bgg_url || `https://boardgamegeek.com/boardgame/${bggId}`,
        };

        const { data: entry, error: upsertErr } = await admin
          .from("game_catalog")
          .upsert(catalogData, { onConflict: "bgg_id" })
          .select("id")
          .single();

        if (upsertErr) { errors.push(`${bggId}: ${upsertErr.message}`); continue; }

        if (entry?.id) {
          const gameIds = games.map(g => g.id);
          await admin.from("games").update({ catalog_id: entry.id }).in("id", gameIds);
          linked += gameIds.length;

          // Backfill catalog_mechanics
          const { data: mechs } = await admin.from("game_mechanics").select("mechanic_id").eq("game_id", firstGame.id);
          if (mechs) {
            for (const m of mechs) {
              await admin.from("catalog_mechanics").upsert({ catalog_id: entry.id, mechanic_id: m.mechanic_id }, { onConflict: "catalog_id,mechanic_id" });
            }
          }

          // Backfill catalog_publishers
          if (firstGame.publisher_id) {
            await admin.from("catalog_publishers").upsert({ catalog_id: entry.id, publisher_id: firstGame.publisher_id }, { onConflict: "catalog_id,publisher_id" });
          }

          // Backfill designers/artists from game tables
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
