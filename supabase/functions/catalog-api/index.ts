/**
 * Catalog API — Read-only REST endpoint for external services (e.g., Cortex AI)
 * 
 * Routes:
 *   GET  /catalog-api/games          — Search/list catalog games with metadata
 *   GET  /catalog-api/games/:id      — Single game detail with mechanics, genres, publishers
 *   GET  /catalog-api/collections/:library_id — Library's game collection
 *   GET  /catalog-api/stats          — Global catalog statistics
 * 
 * Auth: Requires X-API-Key header matching CATALOG_API_KEY secret
 */

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

const CATALOG_API_KEY = Deno.env.get("CATALOG_API_KEY");

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
  const { createClient } = (globalThis as any).__supabase || {};
  
  // Dynamic import for Supabase client
  return import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) => 
    createClient(url, serviceKey)
  );
}

function jsonResponse(data: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number, corsHeaders: Record<string, string>) {
  return jsonResponse({ error: message }, status, corsHeaders);
}

function validateApiKey(req: Request, corsHeaders: Record<string, string>): Response | null {
  if (!CATALOG_API_KEY) {
    console.error("[catalog-api] CATALOG_API_KEY not configured");
    return errorResponse("API not configured", 503, corsHeaders);
  }
  
  const providedKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
  if (!providedKey || providedKey !== CATALOG_API_KEY) {
    return errorResponse("Invalid or missing API key", 401, corsHeaders);
  }
  
  return null; // Auth OK
}

function parseRoute(url: URL): { action: string; param?: string } {
  const parts = url.pathname.split("/").filter(Boolean);
  // Handle /catalog-api/... or /main/catalog-api/...
  const startIdx = parts.indexOf("catalog-api");
  if (startIdx === -1) return { action: "root" };
  
  const action = parts[startIdx + 1] || "root";
  const param = parts[startIdx + 2];
  return { action, param };
}

// GET /games?search=catan&limit=50&offset=0&min_weight=2&max_weight=4&min_players=2&max_players=4&mechanic_names=Trading,Dice+Rolling
async function handleListGames(url: URL, corsHeaders: Record<string, string>) {
  const supabase = await getSupabaseClient();
  
  const search = url.searchParams.get("search") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const minWeight = url.searchParams.get("min_weight");
  const maxWeight = url.searchParams.get("max_weight");
  const minPlayers = url.searchParams.get("min_players");
  const maxPlayers = url.searchParams.get("max_players");
  const expansions = url.searchParams.get("include_expansions") === "true";
  const updatedSince = url.searchParams.get("updated_since"); // ISO date for incremental sync
  const mechanicNamesParam = url.searchParams.get("mechanic_names");

  // If mechanic_names filter is provided, resolve matching catalog IDs first
  let mechanicCatalogIds: string[] | null = null;
  let mechanicMatchCounts: Record<string, number> = {};

  if (mechanicNamesParam) {
    const mechanicNames = mechanicNamesParam.split(",").map(n => n.trim()).filter(Boolean);
    if (mechanicNames.length === 0) {
      return errorResponse("mechanic_names must contain at least one mechanic name", 400, corsHeaders);
    }

    // 1. Find mechanic IDs matching the requested names (case-insensitive)
    const { data: matchedMechanics, error: mechErr } = await supabase
      .from("mechanics")
      .select("id, name")
      .in("name", mechanicNames);

    if (mechErr) return errorResponse(mechErr.message, 500, corsHeaders);
    if (!matchedMechanics || matchedMechanics.length === 0) {
      return jsonResponse({ games: [], total: 0, limit, offset, has_more: false, matched_mechanics: [] }, 200, corsHeaders);
    }

    const mechanicIds = matchedMechanics.map((m: any) => m.id);

    // 2. Find catalog_ids linked to those mechanics
    const { data: catalogMechs, error: cmErr } = await supabase
      .from("catalog_mechanics")
      .select("catalog_id, mechanic_id")
      .in("mechanic_id", mechanicIds);

    if (cmErr) return errorResponse(cmErr.message, 500, corsHeaders);
    if (!catalogMechs || catalogMechs.length === 0) {
      return jsonResponse({ games: [], total: 0, limit, offset, has_more: false, matched_mechanics: matchedMechanics.map((m: any) => m.name) }, 200, corsHeaders);
    }

    // 3. Count matching mechanics per catalog_id for relevance sorting
    for (const cm of catalogMechs) {
      mechanicMatchCounts[cm.catalog_id] = (mechanicMatchCounts[cm.catalog_id] || 0) + 1;
    }

    // Sort by match count descending, take unique IDs
    mechanicCatalogIds = Object.entries(mechanicMatchCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  }

  let query = supabase
    .from("game_catalog")
    .select("id, bgg_id, title, slug, description, image_url, min_players, max_players, play_time_minutes, weight, year_published, suggested_age, is_expansion, bgg_community_rating, created_at, updated_at", { count: "exact" });

  if (!expansions) {
    query = query.eq("is_expansion", false);
  }
  if (search) {
    query = query.ilike("title", `%${search}%`);
  }
  if (minWeight) query = query.gte("weight", parseFloat(minWeight));
  if (maxWeight) query = query.lte("weight", parseFloat(maxWeight));
  if (minPlayers) query = query.gte("max_players", parseInt(minPlayers));
  if (maxPlayers) query = query.lte("min_players", parseInt(maxPlayers));
  if (updatedSince) query = query.gte("updated_at", updatedSince);

  // Apply mechanic filter: restrict to matching catalog IDs
  if (mechanicCatalogIds !== null) {
    // Supabase .in() has a practical limit; batch if needed
    const batchSize = 500;
    if (mechanicCatalogIds.length <= batchSize) {
      query = query.in("id", mechanicCatalogIds);
    } else {
      // Take top N by match count (already sorted)
      query = query.in("id", mechanicCatalogIds.slice(0, batchSize));
    }
  }

  query = query.order("title").range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500, corsHeaders);

  // Re-sort by mechanic match count if mechanic filter was used
  let sortedData = data || [];
  if (mechanicCatalogIds !== null && sortedData.length > 0) {
    sortedData = sortedData.sort((a: any, b: any) => {
      const countA = mechanicMatchCounts[a.id] || 0;
      const countB = mechanicMatchCounts[b.id] || 0;
      if (countB !== countA) return countB - countA;
      return (a.title || "").localeCompare(b.title || "");
    });

    // Attach match_count to each game for consumer convenience
    sortedData = sortedData.map((g: any) => ({
      ...g,
      mechanic_match_count: mechanicMatchCounts[g.id] || 0,
    }));
  }

  return jsonResponse({
    games: sortedData,
    total: count,
    limit,
    offset,
    has_more: (count || 0) > offset + limit,
  }, 200, corsHeaders);
}

// GET /games/:id — full detail with mechanics, genres, publishers, designers, artists
async function handleGetGame(id: string, corsHeaders: Record<string, string>) {
  const supabase = await getSupabaseClient();

  // Fetch game + related data in parallel
  const [gameRes, mechanicsRes, genresRes, publishersRes, designersRes, artistsRes, popularityRes] = await Promise.all([
    supabase.from("game_catalog").select("*").eq("id", id).single(),
    supabase.from("catalog_mechanics").select("mechanic_id, mechanics(id, name, family_id)").eq("catalog_id", id),
    supabase.from("catalog_genres").select("genre").eq("catalog_id", id),
    supabase.from("catalog_publishers").select("publisher_id, publishers(id, name)").eq("catalog_id", id),
    supabase.from("catalog_designers").select("designer_id, designers(id, name)").eq("catalog_id", id),
    supabase.from("catalog_artists").select("artist_id, artists(id, name)").eq("catalog_id", id),
    supabase.from("catalog_popularity").select("*").eq("catalog_id", id).single(),
  ]);

  if (gameRes.error) return errorResponse("Game not found", 404, corsHeaders);

  return jsonResponse({
    ...gameRes.data,
    mechanics: (mechanicsRes.data || []).map((m: any) => m.mechanics).filter(Boolean),
    genres: (genresRes.data || []).map((g: any) => g.genre),
    publishers: (publishersRes.data || []).map((p: any) => p.publishers).filter(Boolean),
    designers: (designersRes.data || []).map((d: any) => d.designers).filter(Boolean),
    artists: (artistsRes.data || []).map((a: any) => a.artists).filter(Boolean),
    popularity: popularityRes.data || null,
  }, 200, corsHeaders);
}

// GET /collections/:library_id — games in a library with play counts
async function handleGetCollection(libraryId: string, corsHeaders: Record<string, string>) {
  const supabase = await getSupabaseClient();

  // Get library info
  const { data: library, error: libError } = await supabase
    .from("libraries")
    .select("id, name, slug")
    .eq("id", libraryId)
    .single();

  if (libError) return errorResponse("Library not found", 404, corsHeaders);

  // Get games with catalog data
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select(`
      id, title, slug, image_url, is_expansion, ownership_status, personal_rating,
      catalog_id,
      game_catalog(id, title, weight, min_players, max_players, play_time_minutes, bgg_community_rating)
    `)
    .eq("library_id", libraryId)
    .order("title");

  if (gamesError) return errorResponse(gamesError.message, 500, corsHeaders);

  // Get play session counts per game
  const gameIds = (games || []).map((g: any) => g.id);
  let sessionCounts: Record<string, number> = {};
  
  if (gameIds.length > 0) {
    // Batch in groups of 50
    for (let i = 0; i < gameIds.length; i += 50) {
      const batch = gameIds.slice(i, i + 50);
      const { data: sessions } = await supabase
        .from("game_sessions")
        .select("game_id")
        .in("game_id", batch);
      
      for (const s of (sessions || [])) {
        sessionCounts[s.game_id] = (sessionCounts[s.game_id] || 0) + 1;
      }
    }
  }

  // Get mechanics per game (via catalog)
  const catalogIds = [...new Set((games || []).map((g: any) => g.catalog_id).filter(Boolean))];
  let mechanicsByGame: Record<string, string[]> = {};
  
  if (catalogIds.length > 0) {
    for (let i = 0; i < catalogIds.length; i += 50) {
      const batch = catalogIds.slice(i, i + 50);
      const { data: mechs } = await supabase
        .from("catalog_mechanics")
        .select("catalog_id, mechanics(name)")
        .in("catalog_id", batch);
      
      for (const m of (mechs || [])) {
        if (!mechanicsByGame[m.catalog_id]) mechanicsByGame[m.catalog_id] = [];
        if ((m as any).mechanics?.name) mechanicsByGame[m.catalog_id].push((m as any).mechanics.name);
      }
    }
  }

  const enrichedGames = (games || []).map((g: any) => ({
    id: g.id,
    title: g.title,
    slug: g.slug,
    image_url: g.image_url,
    is_expansion: g.is_expansion,
    ownership_status: g.ownership_status,
    personal_rating: g.personal_rating,
    catalog_id: g.catalog_id,
    play_count: sessionCounts[g.id] || 0,
    catalog: g.game_catalog || null,
    mechanics: g.catalog_id ? (mechanicsByGame[g.catalog_id] || []) : [],
  }));

  return jsonResponse({
    library,
    games: enrichedGames,
    total: enrichedGames.length,
    summary: {
      total_games: enrichedGames.filter((g: any) => !g.is_expansion).length,
      total_expansions: enrichedGames.filter((g: any) => g.is_expansion).length,
      total_plays: Object.values(sessionCounts).reduce((a, b) => a + b, 0),
      avg_weight: (() => {
        const weights = enrichedGames.map((g: any) => g.catalog?.weight).filter(Boolean);
        return weights.length ? +(weights.reduce((a: number, b: number) => a + b, 0) / weights.length).toFixed(2) : null;
      })(),
    },
  }, 200, corsHeaders);
}

// GET /stats — global catalog overview
async function handleStats(corsHeaders: Record<string, string>) {
  const supabase = await getSupabaseClient();

  const [totalRes, baseRes, expRes, mechanicsRes, genresRes] = await Promise.all([
    supabase.from("game_catalog").select("id", { count: "exact", head: true }),
    supabase.from("game_catalog").select("id", { count: "exact", head: true }).eq("is_expansion", false),
    supabase.from("game_catalog").select("id", { count: "exact", head: true }).eq("is_expansion", true),
    supabase.from("mechanics").select("id", { count: "exact", head: true }),
    supabase.from("catalog_genres").select("genre").then(res => {
      const genres = [...new Set((res.data || []).map((g: any) => g.genre))];
      return { count: genres.length, genres };
    }),
  ]);

  return jsonResponse({
    total_entries: totalRes.count || 0,
    base_games: baseRes.count || 0,
    expansions: expRes.count || 0,
    total_mechanics: mechanicsRes.count || 0,
    unique_genres: (genresRes as any).count || 0,
    available_genres: (genresRes as any).genres || [],
    api_version: "1.0",
    endpoints: [
      "GET /catalog-api/games",
      "GET /catalog-api/games/:id",
      "GET /catalog-api/collections/:library_id",
      "GET /catalog-api/stats",
    ],
  }, 200, corsHeaders);
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  // Only GET requests
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  // Validate API key
  const authError = validateApiKey(req, corsHeaders);
  if (authError) return authError;

  const url = new URL(req.url);
  const { action, param } = parseRoute(url);

  try {
    switch (action) {
      case "games":
        if (param) return await handleGetGame(param, corsHeaders);
        return await handleListGames(url, corsHeaders);
      
      case "collections":
        if (!param) return errorResponse("Library ID required", 400, corsHeaders);
        return await handleGetCollection(param, corsHeaders);
      
      case "stats":
        return await handleStats(corsHeaders);
      
      case "root":
        return jsonResponse({
          service: "GameTaverns Catalog API",
          version: "1.0",
          docs: "Use X-API-Key header for authentication. GET /stats for available endpoints.",
        }, 200, corsHeaders);
      
      default:
        return errorResponse(`Unknown endpoint: ${action}`, 404, corsHeaders);
    }
  } catch (err) {
    console.error("[catalog-api] Error:", err);
    return errorResponse("Internal server error", 500, corsHeaders);
  }
};

export default handler;

Deno.serve(handler);
