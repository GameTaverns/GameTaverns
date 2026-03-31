import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CORTEX_ENDPOINT = "https://cortex.tzolak.com/api/lmstudio";

// ── In-memory cache for AI reasons (survives across requests within same Deno isolate) ──
const aiReasonsCache = new Map<string, { data: any; ts: number }>();
const AI_CACHE_TTL_MS = 30 * 60_000; // 30 minutes

interface ScoredGame {
  id: string;
  title: string;
  slug: string | null;
  image_url: string | null;
  difficulty: string | null;
  play_time: string | null;
  min_players: number | null;
  max_players: number | null;
  genres: string[];
  reason: string;
  score: number;
  library_count?: number;
  session_count?: number;
  signal_breakdown?: Record<string, number>;
}

// ── Scoring weights ──
const WEIGHTS = {
  GENRE_PRIMARY:    12,   // Primary genre match (most important signal)
  GENRE_SECONDARY:   6,   // Secondary/tertiary genre match
  MECHANIC_FAMILY:   4,   // Mechanic family overlap
  MECHANIC_EXACT:    2,   // Exact mechanic overlap
  WEIGHT_CLOSE:      5,   // Weight within 0.5
  WEIGHT_NEAR:       3,   // Weight within 1.0
  WEIGHT_FAR:        1,   // Weight within 1.5
  PLAYER_OVERLAP:    1,   // Per overlapping player count (max 3)
  PLAYTIME_CLOSE:    3,   // Play time within 15 min
  PLAYTIME_NEAR:     1,   // Play time within 30 min
  INVERSE_POP_MAX:   4,   // Max bonus for rare/hidden gem games
  SESSION_POP_MAX:   5,   // Max bonus for frequently-played games
  UNPLAYED_BOOST:    8,   // Bonus for unplayed library games (shelf of shame)
  UNDERPLAYED_BOOST: 4,   // Bonus for games with < 3 plays
  OVERPLAYED_PENALTY: -6, // Penalty for heavily played library games (20+ sessions)
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { game_id, library_id, limit = 10 } = await req.json();

    if (!game_id || !library_id) {
      return new Response(
        JSON.stringify({ error: "game_id and library_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is authenticated — skip expensive Cortex AI for anonymous/bot traffic
    const authHeader = req.headers.get("Authorization") || "";
    const hasAuth = authHeader.startsWith("Bearer ") && authHeader.length > 20;
    const skipCortex = !hasAuth;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 1. Fetch source game with mechanics ──
    const { data: sourceGame, error: sourceError } = await supabase
      .from("games")
      .select(`
        id, title, description, difficulty, play_time, game_type,
        min_players, max_players, catalog_id,
        game_mechanics(mechanic:mechanics(id, name, family_id))
      `)
      .eq("id", game_id)
      .single();

    if (sourceError || !sourceGame) {
      return new Response(
        JSON.stringify({ error: "Game not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sourceMechanics = (sourceGame.game_mechanics || [])
      .map((gm: any) => gm.mechanic)
      .filter(Boolean);
    const sourceFamilyIds = new Set(sourceMechanics.map((m: any) => m.family_id).filter(Boolean));
    const sourceMechanicIds = new Set(sourceMechanics.map((m: any) => m.id).filter(Boolean));
    const sourceMechanicNames = sourceMechanics.map((m: any) => m.name).filter(Boolean);

    // ── 2. Fetch catalog data: weight, playtime, genres, description ──
    let sourceWeight: number | null = null;
    let sourcePlayTimeMinutes: number | null = null;
    let sourceGenres: string[] = [];
    let sourceCatalogDescription: string | null = null;

    if (sourceGame.catalog_id) {
      const [catalogResult, genreResult] = await Promise.all([
        supabase
          .from("game_catalog")
          .select("weight, play_time_minutes, min_players, max_players, description")
          .eq("id", sourceGame.catalog_id)
          .single(),
        supabase
          .from("catalog_genres")
          .select("genre, display_order")
          .eq("catalog_id", sourceGame.catalog_id)
          .order("display_order"),
      ]);

      if (catalogResult.data) {
        sourceWeight = catalogResult.data.weight;
        sourcePlayTimeMinutes = catalogResult.data.play_time_minutes;
        sourceCatalogDescription = catalogResult.data.description;
      }
      if (genreResult.data) {
        sourceGenres = genreResult.data.map((g: any) => g.genre);
      }
    }

    const sourceDescription = sourceCatalogDescription || sourceGame.description || "";
    const sourceMinPlayers = sourceGame.min_players || 1;
    const sourceMaxPlayers = sourceGame.max_players || 4;

    console.log(`[rec-v2] Source: "${sourceGame.title}" genres=[${sourceGenres}] mechanics=[${sourceMechanicNames.slice(0, 5)}] weight=${sourceWeight}`);

    // ── 3. Get owned catalog IDs to exclude + session counts for library games ──
    const [ownedResult, sessionCountsResult] = await Promise.all([
      supabase
        .from("games")
        .select("id, catalog_id")
        .eq("library_id", library_id)
        .not("catalog_id", "is", null),
      supabase
        .from("game_sessions")
        .select("game_id")
        .eq("library_id", library_id),
    ]);

    const ownedCatalogIds = new Set((ownedResult.data || []).map((g: any) => g.catalog_id));

    // Build session count map for library games
    const librarySessionCounts = new Map<string, number>();
    if (sessionCountsResult.data) {
      for (const row of sessionCountsResult.data) {
        librarySessionCounts.set(row.game_id, (librarySessionCounts.get(row.game_id) || 0) + 1);
      }
    }

    // ── 4. Get popularity data + platform-wide session counts ──
    const [popResult, platformSessionsResult] = await Promise.all([
      supabase
        .from("catalog_popularity")
        .select("catalog_id, library_count")
        .not("catalog_id", "is", null)
        .gt("library_count", 0)
        .limit(1000),
      // Aggregate session counts by catalog_id across the platform
      Promise.resolve().then(() => supabase.rpc("get_catalog_session_counts")).catch(() => ({ data: null })),
    ]);

    const popularityMap = new Map<string, number>();
    if (popResult.data) {
      for (const row of popResult.data) {
        if (row.catalog_id) popularityMap.set(row.catalog_id, row.library_count || 0);
      }
    }
    const allCounts = Array.from(popularityMap.values()).sort((a, b) => a - b);
    const p25 = allCounts[Math.floor(allCounts.length * 0.25)] || 1;
    const maxCount = allCounts[allCounts.length - 1] || 1;

    // Platform session popularity map (catalog_id -> total sessions across all users)
    const platformSessionMap = new Map<string, number>();
    if (platformSessionsResult.data) {
      for (const row of platformSessionsResult.data as any[]) {
        if (row.catalog_id) platformSessionMap.set(row.catalog_id, row.session_count || 0);
      }
    }
    const sessionCounts = Array.from(platformSessionMap.values()).sort((a, b) => a - b);
    const maxSessions = sessionCounts[sessionCounts.length - 1] || 1;

    // ── 5. Find candidates via ALL signals simultaneously ──
    const candidateCatalogIds = new Set<string>();
    const candidateQueries: Promise<void>[] = [];

    // 5a. Genre-based candidates
    if (sourceGenres.length > 0) {
      candidateQueries.push(
        supabase
          .from("catalog_genres")
          .select("catalog_id")
          .in("genre", sourceGenres)
          .limit(500)
          .then(({ data }) => {
            if (data) for (const row of data) {
              if (row.catalog_id !== sourceGame.catalog_id && !ownedCatalogIds.has(row.catalog_id))
                candidateCatalogIds.add(row.catalog_id);
            }
          })
      );
    }

    // 5b. Mechanic-based candidates
    if (sourceMechanicIds.size > 0) {
      candidateQueries.push(
        supabase
          .from("catalog_mechanics")
          .select("catalog_id")
          .in("mechanic_id", Array.from(sourceMechanicIds))
          .limit(500)
          .then(({ data }) => {
            if (data) for (const row of data) {
              if (row.catalog_id !== sourceGame.catalog_id && !ownedCatalogIds.has(row.catalog_id))
                candidateCatalogIds.add(row.catalog_id);
            }
          })
      );
    }

    // 5c. Weight/complexity-based candidates
    if (sourceWeight !== null) {
      const weightQuery = supabase
        .from("game_catalog")
        .select("id")
        .eq("is_expansion", false)
        .gte("weight", Math.max(0.5, sourceWeight - 0.75))
        .lte("weight", sourceWeight + 0.75);

      if (sourceMinPlayers > 1) weightQuery.gte("min_players", Math.max(1, sourceMinPlayers - 1));
      weightQuery.lte("max_players", sourceMaxPlayers + 2);

      candidateQueries.push(
        weightQuery.limit(200).then(({ data }) => {
          if (data) for (const row of data) {
            if (row.id !== sourceGame.catalog_id && !ownedCatalogIds.has(row.id))
              candidateCatalogIds.add(row.id);
          }
        })
      );
    }

    // 5d. Play time similarity candidates
    if (sourcePlayTimeMinutes !== null) {
      candidateQueries.push(
        supabase
          .from("game_catalog")
          .select("id")
          .eq("is_expansion", false)
          .gte("play_time_minutes", Math.max(5, sourcePlayTimeMinutes - 20))
          .lte("play_time_minutes", sourcePlayTimeMinutes + 20)
          .limit(150)
          .then(({ data }) => {
            if (data) for (const row of data) {
              if (row.id !== sourceGame.catalog_id && !ownedCatalogIds.has(row.id))
                candidateCatalogIds.add(row.id);
            }
          })
      );
    }

    await Promise.all(candidateQueries);

    console.log(`[rec-v2] Found ${candidateCatalogIds.size} unique candidates from all signal pools`);

    // ── 6. Fetch candidate details (batched to avoid PostgREST URL length limits) ──
    const candidateIds = Array.from(candidateCatalogIds).slice(0, 300);
    let allDiscoveryScored: ScoredGame[] = [];
    const BATCH_SIZE = 40; // Self-hosted PostgREST has URL length limits

    if (candidateIds.length > 0) {
      // Batch fetch all candidate data in chunks of BATCH_SIZE
      const allCatalogData: any[] = [];
      const candidateGenreMap = new Map<string, string[]>();
      const candidateMechanicMap = new Map<string, any[]>();

      const batches: string[][] = [];
      for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
        batches.push(candidateIds.slice(i, i + BATCH_SIZE));
      }

      console.log(`[rec-v2] Fetching ${candidateIds.length} candidates in ${batches.length} batches of ${BATCH_SIZE}`);

      await Promise.all(batches.map(async (batchIds) => {
        const [catalogResult, genresResult, mechanicsResult] = await Promise.all([
          supabase
            .from("game_catalog")
            .select("id, title, slug, image_url, weight, play_time_minutes, min_players, max_players, description, is_expansion")
            .in("id", batchIds)
            .eq("is_expansion", false)
            .limit(BATCH_SIZE),
          supabase
            .from("catalog_genres")
            .select("catalog_id, genre, display_order")
            .in("catalog_id", batchIds)
            .order("display_order")
            .limit(BATCH_SIZE * 4),
          supabase
            .from("catalog_mechanics")
            .select("catalog_id, mechanic:mechanics(id, name, family_id)")
            .in("catalog_id", batchIds)
            .limit(BATCH_SIZE * 6),
        ]);

        if (catalogResult.data) allCatalogData.push(...catalogResult.data);

        if (genresResult.data) {
          for (const row of genresResult.data) {
            const arr = candidateGenreMap.get(row.catalog_id) || [];
            arr.push(row.genre);
            candidateGenreMap.set(row.catalog_id, arr);
          }
        }

        if (mechanicsResult.data) {
          for (const row of mechanicsResult.data as any[]) {
            if (!row.mechanic) continue;
            const arr = candidateMechanicMap.get(row.catalog_id) || [];
            arr.push(row.mechanic);
            candidateMechanicMap.set(row.catalog_id, arr);
          }
        }
      }));

      console.log(`[rec-v2] Fetched ${allCatalogData.length} catalog entries from batches`);

      allDiscoveryScored = allCatalogData.map((cg: any) => {
        const genres = candidateGenreMap.get(cg.id) || [];
        const mechanics = candidateMechanicMap.get(cg.id) || [];
        return scoreCandidate(
          cg, genres, mechanics,
          sourceGenres, sourceFamilyIds, sourceMechanicIds,
          sourceWeight, sourcePlayTimeMinutes, sourceMinPlayers, sourceMaxPlayers,
          popularityMap, maxCount,
          platformSessionMap, maxSessions,
          false, // isLibrary
          0      // sessionCount (not applicable for discoveries)
        );
      }).filter((g) => g.score > 0)
        .sort((a, b) => b.score - a.score);
    }

    console.log(`[rec-v2] Scored ${allDiscoveryScored.length} viable discoveries`);

    // ── 7. Collection matches (games in user's library) — play-history aware ──
    const { data: libraryGames } = await supabase
      .from("games")
      .select(`
        id, title, slug, image_url, difficulty, play_time,
        min_players, max_players, catalog_id,
        game_mechanics(mechanic:mechanics(id, name, family_id))
      `)
      .eq("library_id", library_id)
      .neq("id", game_id)
      .eq("is_expansion", false)
      .eq("is_coming_soon", false)
      .limit(200);

    // Fetch genres for library games
    const libraryCatalogIds = (libraryGames || [])
      .map((g: any) => g.catalog_id)
      .filter(Boolean);

    const libGenreMap = new Map<string, string[]>();
    if (libraryCatalogIds.length > 0) {
      // Batch library genre lookups too
      const libBatches: string[][] = [];
      for (let i = 0; i < libraryCatalogIds.length; i += BATCH_SIZE) {
        libBatches.push(libraryCatalogIds.slice(i, i + BATCH_SIZE));
      }
      await Promise.all(libBatches.map(async (batchIds) => {
        const { data: libGenres } = await supabase
          .from("catalog_genres")
          .select("catalog_id, genre, display_order")
          .in("catalog_id", batchIds)
          .order("display_order")
          .limit(BATCH_SIZE * 4);
        if (libGenres) {
          for (const row of libGenres) {
            const arr = libGenreMap.get(row.catalog_id) || [];
            arr.push(row.genre);
            libGenreMap.set(row.catalog_id, arr);
          }
        }
      }));
    }

    const allCollectionScored = (libraryGames || []).map((g: any) => {
      const mechanics = (g.game_mechanics || []).map((gm: any) => gm.mechanic).filter(Boolean);
      const genres = g.catalog_id ? (libGenreMap.get(g.catalog_id) || []) : [];
      const sessionCount = librarySessionCounts.get(g.id) || 0;

      return scoreCandidate(
        { ...g, weight: labelToWeight(g.difficulty), play_time_minutes: null },
        genres, mechanics,
        sourceGenres, sourceFamilyIds, sourceMechanicIds,
        sourceWeight, sourcePlayTimeMinutes, sourceMinPlayers, sourceMaxPlayers,
        popularityMap, maxCount,
        platformSessionMap, maxSessions,
        true,       // isLibrary
        sessionCount // play history for this specific user
      );
    }).filter((g) => g.score > 0)
      .sort((a, b) => b.score - a.score);

    const collectionMatches = allCollectionScored.slice(0, limit);

    // ── 8. Anti-bias selection: diversity slots + weighted sampling ──
    const diversitySlots = limit >= 5 ? 2 : 1;
    const mainSlots = limit - diversitySlots;

    const lowPopGems = allDiscoveryScored.filter((g) => (g.library_count || 0) <= p25);
    const regularPool = allDiscoveryScored.filter((g) => (g.library_count || 0) > p25);

    const sampledRegular = weightedRandomSample(regularPool.slice(0, 25), mainSlots);
    const sampledDiversity = weightedRandomSample(lowPopGems.slice(0, 15), diversitySlots);
    let discoveries = [...sampledRegular, ...sampledDiversity].slice(0, limit);

    // ── 9. Cortex AI: generate natural language reasons ──
    if (discoveries.length > 0 || collectionMatches.length > 0) {
      try {
        const aiResults = await generateAIReasons(
          sourceGame.title,
          sourceDescription,
          sourceGenres,
          sourceMechanicNames,
          sourceWeight,
          discoveries,
          collectionMatches
        );

        if (aiResults) {
          discoveries = applyAIReasons(discoveries, aiResults.discoveries || []);
          if (aiResults.collection_matches) {
            const enhancedCollection = applyAIReasons(collectionMatches, aiResults.collection_matches);
            collectionMatches.splice(0, collectionMatches.length, ...enhancedCollection);
          }
        }
      } catch (aiErr) {
        console.warn("[rec-v2] Cortex AI reasons failed, using deterministic reasons:", aiErr);
      }
    }

    // ── 10. Build result ──
    const result = {
      discoveries,
      collection_matches: collectionMatches,
      recommendations: [...discoveries, ...collectionMatches].slice(0, limit),
    };

    // ── 11. Logging ──
    try {
      const avgPop = discoveries.length > 0
        ? discoveries.reduce((s, g) => s + (g.library_count || 0), 0) / discoveries.length
        : 0;

      supabase.from("system_logs").insert({
        level: "info",
        source: "recommendations-v2",
        message: `Recs for "${sourceGame.title}" — ${discoveries.length} discoveries, ${collectionMatches.length} collection`,
        metadata: {
          source_game: sourceGame.title,
          source_genres: sourceGenres,
          candidates_found: candidateCatalogIds.size,
          scored_viable: allDiscoveryScored.length,
          avg_discovery_popularity: Math.round(avgPop * 10) / 10,
          discovery_titles: discoveries.map((g) => ({ title: g.title, score: g.score, genres: g.genres })),
          collection_titles: collectionMatches.map((g) => ({
            title: g.title,
            score: g.score,
            genres: g.genres,
            sessions: g.session_count,
          })),
        },
        library_id,
      }).then(() => {});
    } catch {}

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[rec-v2] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to get recommendations" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ══════════════════════════════════════════════════
// Scoring: Genre-first, mechanic-supplemented, play-history aware
// ══════════════════════════════════════════════════

function scoreCandidate(
  candidate: any,
  candidateGenres: string[],
  candidateMechanics: any[],
  sourceGenres: string[],
  sourceFamilyIds: Set<string>,
  sourceMechanicIds: Set<string>,
  sourceWeight: number | null,
  sourcePlayTime: number | null,
  sourceMinPlayers: number,
  sourceMaxPlayers: number,
  popularityMap: Map<string, number>,
  maxCount: number,
  platformSessionMap: Map<string, number>,
  maxSessions: number,
  isLibrary = false,
  sessionCount = 0
): ScoredGame {
  const signals: Record<string, number> = {};

  // ── Genre scoring (strongest signal) ──
  let genreScore = 0;
  const sharedGenres: string[] = [];
  for (let i = 0; i < candidateGenres.length; i++) {
    if (sourceGenres.includes(candidateGenres[i])) {
      sharedGenres.push(candidateGenres[i]);
      const isSourcePrimary = sourceGenres.indexOf(candidateGenres[i]) === 0;
      const isCandidatePrimary = i === 0;
      if (isSourcePrimary || isCandidatePrimary) {
        genreScore += WEIGHTS.GENRE_PRIMARY;
      } else {
        genreScore += WEIGHTS.GENRE_SECONDARY;
      }
    }
  }
  signals.genre = genreScore;

  // ── Mechanic family overlap ──
  const candidateFamilyIds = new Set(candidateMechanics.map((m) => m.family_id).filter(Boolean));
  const candidateMechIds = new Set(candidateMechanics.map((m) => m.id).filter(Boolean));

  let familyOverlap = 0;
  for (const fid of candidateFamilyIds) {
    if (sourceFamilyIds.has(fid)) familyOverlap++;
  }

  let mechOverlap = 0;
  for (const mid of candidateMechIds) {
    if (sourceMechanicIds.has(mid)) mechOverlap++;
  }

  const totalMechs = candidateMechIds.size || 1;
  const mechanicScore = ((familyOverlap * WEIGHTS.MECHANIC_FAMILY) + (mechOverlap * WEIGHTS.MECHANIC_EXACT)) / Math.max(1, Math.sqrt(totalMechs));
  signals.mechanic = Math.round(mechanicScore * 10) / 10;

  // ── Weight similarity ──
  const cWeight = candidate.weight ?? null;
  let weightScore = 0;
  if (sourceWeight !== null && cWeight !== null) {
    const diff = Math.abs(sourceWeight - cWeight);
    weightScore = diff < 0.5 ? WEIGHTS.WEIGHT_CLOSE : diff < 1.0 ? WEIGHTS.WEIGHT_NEAR : diff < 1.5 ? WEIGHTS.WEIGHT_FAR : 0;
  }
  signals.weight = weightScore;

  // ── Play time similarity ──
  const cPlayTime = candidate.play_time_minutes ?? null;
  let playTimeScore = 0;
  if (sourcePlayTime !== null && cPlayTime !== null) {
    const diff = Math.abs(sourcePlayTime - cPlayTime);
    playTimeScore = diff <= 15 ? WEIGHTS.PLAYTIME_CLOSE : diff <= 30 ? WEIGHTS.PLAYTIME_NEAR : 0;
  }
  signals.playtime = playTimeScore;

  // ── Player count overlap ──
  const cMin = candidate.min_players || 1;
  const cMax = candidate.max_players || 4;
  const overlapMin = Math.max(sourceMinPlayers, cMin);
  const overlapMax = Math.min(sourceMaxPlayers, cMax);
  const playerOverlap = Math.max(0, Math.min(3, overlapMax - overlapMin + 1));
  signals.players = playerOverlap * WEIGHTS.PLAYER_OVERLAP;

  // ── Inverse popularity (discoveries only) ──
  const catalogId = candidate.catalog_id || candidate.id;
  const libCount = popularityMap.get(catalogId) || 0;
  let popBonus = 0;
  if (!isLibrary && maxCount > 0) {
    const ratio = libCount / maxCount;
    popBonus = Math.round(WEIGHTS.INVERSE_POP_MAX * (1 - Math.sqrt(ratio)));
  }
  signals.rarity = popBonus;

  // ── Session popularity signal (discoveries only) ──
  // Games that are frequently PLAYED (not just owned) get a boost
  let sessionPopBonus = 0;
  if (!isLibrary && maxSessions > 0) {
    const catalogSessions = platformSessionMap.get(catalogId) || 0;
    if (catalogSessions > 0) {
      // Logarithmic scale so mega-popular games don't dominate
      sessionPopBonus = Math.round(WEIGHTS.SESSION_POP_MAX * Math.log(1 + catalogSessions) / Math.log(1 + maxSessions));
    }
  }
  signals.session_pop = sessionPopBonus;

  // ── Play history signal (library games only) ──
  // Boost unplayed/underplayed, penalize overplayed
  let playHistoryScore = 0;
  if (isLibrary) {
    if (sessionCount === 0) {
      playHistoryScore = WEIGHTS.UNPLAYED_BOOST; // Shelf of shame — surface these!
    } else if (sessionCount <= 2) {
      playHistoryScore = WEIGHTS.UNDERPLAYED_BOOST; // Tried once, forgotten
    } else if (sessionCount >= 20) {
      playHistoryScore = WEIGHTS.OVERPLAYED_PENALTY; // Already well-loved, don't need reminding
    }
    // 3-19 plays = neutral (no bonus or penalty)
  }
  signals.play_history = playHistoryScore;

  // ── Total ──
  const totalScore = Object.values(signals).reduce((a, b) => a + b, 0);

  // ── Build deterministic reason (Cortex will override if available) ──
  const reasons: string[] = [];

  // For library games, lead with play status
  if (isLibrary && sessionCount === 0) {
    reasons.push("Unplayed — time to try it!");
  } else if (isLibrary && sessionCount <= 2) {
    reasons.push("Only played once — give it another go");
  }

  if (sharedGenres.length > 0) reasons.push(`${sharedGenres.join(", ")}`);

  const sharedMechNames = candidateMechanics
    .filter((m) => sourceMechanicIds.has(m.id) || sourceFamilyIds.has(m.family_id))
    .map((m) => m.name)
    .slice(0, 2);
  if (sharedMechNames.length > 0) reasons.push(sharedMechNames.join(", "));
  if (weightScore >= WEIGHTS.WEIGHT_NEAR) reasons.push("Similar complexity");
  if (playerOverlap >= 2) reasons.push("Similar player count");
  if (popBonus >= 3) reasons.push("Hidden gem");
  if (sessionPopBonus >= 3) reasons.push("Frequently played");
  if (reasons.length === 0) reasons.push("Related game");

  return {
    id: candidate.id,
    title: candidate.title,
    slug: candidate.slug,
    image_url: candidate.image_url,
    difficulty: candidate.difficulty || weightToLabel(cWeight),
    play_time: candidate.play_time || (cPlayTime ? `${cPlayTime} min` : null),
    min_players: candidate.min_players,
    max_players: candidate.max_players,
    genres: candidateGenres,
    reason: reasons.join(" · "),
    score: Math.round(totalScore),
    library_count: libCount,
    session_count: sessionCount,
    signal_breakdown: signals,
  };
}

// ══════════════════════════════════════════════════
// Cortex AI: Natural language "vibe" reasons
// ══════════════════════════════════════════════════

async function generateAIReasons(
  sourceTitle: string,
  sourceDescription: string,
  sourceGenres: string[],
  sourceMechanics: string[],
  sourceWeight: number | null,
  discoveries: ScoredGame[],
  collectionMatches: ScoredGame[]
): Promise<{ discoveries?: Array<{ id: string; reason: string }>; collection_matches?: Array<{ id: string; reason: string }> } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const systemPrompt = `Write brief board game recommendation reasons. Max 80 chars each. Casual tone. Never start with "Both". For 0-session games say "unplayed". Reply JSON only: {"discoveries":[{"id":"...","reason":"..."}],"collection_matches":[{"id":"...","reason":"..."}]}`;

    const userPrompt = `Source: "${sourceTitle}" [${sourceGenres.join(",")}] [${sourceMechanics.slice(0, 4).join(",")}]

Discoveries:
${discoveries.map((g) => `${g.id}|${g.title}|${g.genres.join(",")}`).join("\n")}

Collection:
${collectionMatches.map((g) => `${g.id}|${g.title}|${g.genres.join(",")}|s=${g.session_count ?? 0}`).join("\n")}`;

    const response = await fetch(CORTEX_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[rec-v2] Cortex returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      return JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        return JSON.parse(objMatch[0]);
      }
      return null;
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[rec-v2] Cortex timed out for AI reasons");
    } else {
      console.warn("[rec-v2] Cortex AI reasons error:", err);
    }
    return null;
  }
}

function applyAIReasons(
  games: ScoredGame[],
  aiReasons: Array<{ id: string; reason: string }>
): ScoredGame[] {
  if (!aiReasons || aiReasons.length === 0) return games;

  const reasonMap = new Map(aiReasons.map((r) => [r.id, r.reason]));
  return games.map((g) => {
    const aiReason = reasonMap.get(g.id);
    return aiReason ? { ...g, reason: aiReason } : g;
  });
}

// ══════════════════════════════════════════════════
// Utilities
// ══════════════════════════════════════════════════

function weightedRandomSample(pool: ScoredGame[], count: number): ScoredGame[] {
  if (pool.length <= count) return [...pool];

  const result: ScoredGame[] = [];
  const remaining = [...pool];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, g) => sum + Math.max(1, g.score), 0);
    let rand = Math.random() * totalWeight;

    for (let j = 0; j < remaining.length; j++) {
      rand -= Math.max(1, remaining[j].score);
      if (rand <= 0) {
        result.push(remaining[j]);
        remaining.splice(j, 1);
        break;
      }
    }
  }

  return result;
}

function weightToLabel(weight: number | null): string | null {
  if (weight === null) return null;
  if (weight < 1.5) return "Light";
  if (weight < 2.5) return "Medium Light";
  if (weight < 3.5) return "Medium";
  if (weight < 4.0) return "Medium Heavy";
  return "Heavy";
}

function labelToWeight(label: string | null): number | null {
  if (!label) return null;
  // Handle both "Medium" and "3 - Medium" formats
  const cleaned = label.replace(/^\d+\s*-\s*/, "").trim().toLowerCase();
  const map: Record<string, number> = {
    light: 1.0, "medium light": 2.0, medium: 3.0, "medium heavy": 3.75, heavy: 4.5,
  };
  return map[cleaned] ?? null;
}

if (import.meta.main) {
  Deno.serve(handler);
}
