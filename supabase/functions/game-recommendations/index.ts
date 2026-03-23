import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScoredGame {
  id: string;
  title: string;
  slug: string | null;
  image_url: string | null;
  difficulty: string | null;
  play_time: string | null;
  min_players: number | null;
  max_players: number | null;
  reason: string;
  score: number;
  /** Number of libraries that own this game (for bias metrics) */
  library_count?: number;
  /** Normalized mechanic score (overlap / total mechanics on candidate) */
  normalized_mechanic_score?: number;
}

/**
 * Anti-popularity-bias game recommendation engine.
 *
 * Four bias-mitigation strategies:
 * 1. Inverse popularity weighting — rare games get a scoring boost
 * 2. Normalized mechanic scoring — divides by candidate's total mechanics
 * 3. Diversity slot reservation — 1-2 slots reserved for low-ownership gems
 * 4. Random sampling from qualified pool — top-20 → random-5 for serendipity
 *
 * Returns two lists:
 * - discoveries: Games from the global catalog the user does NOT own
 * - collection_matches: Similar games already in the user's library
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { game_id, library_id, limit = 5 } = await req.json();

    if (!game_id || !library_id) {
      return new Response(
        JSON.stringify({ error: "game_id and library_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch the source game with its catalog link and mechanics
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

    // Extract mechanic family IDs and names for scoring
    const sourceMechanics = (sourceGame.game_mechanics || [])
      .map((gm: any) => gm.mechanic)
      .filter(Boolean);
    const sourceFamilyIds = new Set(
      sourceMechanics.map((m: any) => m.family_id).filter(Boolean)
    );
    const sourceMechanicIds = new Set(
      sourceMechanics.map((m: any) => m.id).filter(Boolean)
    );

    // Get catalog-level info for weight/playtime if available
    let sourceWeight: number | null = null;
    let sourcePlayTimeMinutes: number | null = null;
    if (sourceGame.catalog_id) {
      const { data: catalogEntry } = await supabase
        .from("game_catalog")
        .select("weight, play_time_minutes, min_players, max_players")
        .eq("id", sourceGame.catalog_id)
        .single();
      if (catalogEntry) {
        sourceWeight = catalogEntry.weight;
        sourcePlayTimeMinutes = catalogEntry.play_time_minutes;
      }
    }

    const sourceMinPlayers = sourceGame.min_players || 1;
    const sourceMaxPlayers = sourceGame.max_players || 4;

    // Get all catalog_ids owned by this library (to exclude from discoveries)
    const { data: ownedGames } = await supabase
      .from("games")
      .select("catalog_id")
      .eq("library_id", library_id)
      .not("catalog_id", "is", null);
    const ownedCatalogIds = new Set(
      (ownedGames || []).map((g: any) => g.catalog_id)
    );

    // ── Fetch popularity data for inverse weighting ──
    // Get library_count for candidates via catalog_popularity view
    const popularityMap = new Map<string, number>();
    const { data: popData } = await supabase
      .from("catalog_popularity")
      .select("catalog_id, library_count")
      .not("catalog_id", "is", null)
      .gt("library_count", 0)
      .limit(1000);
    if (popData) {
      for (const row of popData) {
        if (row.catalog_id) popularityMap.set(row.catalog_id, row.library_count || 0);
      }
    }

    // Calculate percentile thresholds for diversity slots
    const allCounts = Array.from(popularityMap.values()).sort((a, b) => a - b);
    const p25 = allCounts[Math.floor(allCounts.length * 0.25)] || 1;
    const medianCount = allCounts[Math.floor(allCounts.length * 0.5)] || 1;
    const maxCount = allCounts[allCounts.length - 1] || 1;

    // ── SECTION 1: Collection Matches (games in user's library) ──
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

    const allCollectionScored = scoreGames(
      libraryGames || [],
      sourceFamilyIds,
      sourceMechanicIds,
      sourceMinPlayers,
      sourceMaxPlayers,
      sourceWeight,
      sourcePlayTimeMinutes,
      popularityMap,
      maxCount,
      "library"
    );
    // Collection matches: just use top scores (no anti-bias needed for your own library)
    const collectionMatches = allCollectionScored.slice(0, limit);

    // ── SECTION 2: Discoveries (from global catalog, NOT owned) ──
    let allDiscoveryScored: ScoredGame[] = [];

    if (sourceMechanicIds.size > 0) {
      const mechanicIdArray = Array.from(sourceMechanicIds);
      const { data: matchingCatalogMechanics } = await supabase
        .from("catalog_mechanics")
        .select("catalog_id")
        .in("mechanic_id", mechanicIdArray)
        .limit(500);

      if (matchingCatalogMechanics && matchingCatalogMechanics.length > 0) {
        const candidateCatalogIds = [
          ...new Set(
            matchingCatalogMechanics
              .map((cm: any) => cm.catalog_id)
              .filter((cid: string) => !ownedCatalogIds.has(cid) && cid !== sourceGame.catalog_id)
          ),
        ].slice(0, 200); // increased cap for better sampling pool

        if (candidateCatalogIds.length > 0) {
          const { data: catalogGames } = await supabase
            .from("game_catalog")
            .select(`
              id, title, slug, image_url, weight, play_time_minutes,
              min_players, max_players, is_expansion,
              catalog_mechanics(mechanic:mechanics(id, name, family_id))
            `)
            .in("id", candidateCatalogIds)
            .eq("is_expansion", false)
            .limit(200);

          if (catalogGames) {
            const mappedCatalogGames = catalogGames.map((cg: any) => ({
              id: cg.id,
              title: cg.title,
              slug: cg.slug,
              image_url: cg.image_url,
              difficulty: weightToLabel(cg.weight),
              play_time: cg.play_time_minutes ? `${cg.play_time_minutes} min` : null,
              min_players: cg.min_players,
              max_players: cg.max_players,
              catalog_id: cg.id, // catalog entries: id IS catalog_id
              game_mechanics: (cg.catalog_mechanics || []),
            }));

            allDiscoveryScored = scoreGames(
              mappedCatalogGames,
              sourceFamilyIds,
              sourceMechanicIds,
              sourceMinPlayers,
              sourceMaxPlayers,
              sourceWeight,
              sourcePlayTimeMinutes,
              popularityMap,
              maxCount,
              "catalog"
            );
          }
        }
      }
    }

    // Fallback: if no mechanic-based discoveries, try weight/player-count similarity
    if (allDiscoveryScored.length === 0 && sourceWeight !== null) {
      const { data: fallbackCatalog } = await supabase
        .from("game_catalog")
        .select("id, title, slug, image_url, weight, play_time_minutes, min_players, max_players")
        .eq("is_expansion", false)
        .gte("weight", Math.max(1, (sourceWeight || 2) - 0.75))
        .lte("weight", (sourceWeight || 2) + 0.75)
        .gte("min_players", Math.max(1, sourceMinPlayers - 1))
        .lte("max_players", sourceMaxPlayers + 2)
        .limit(50);

      if (fallbackCatalog) {
        const filtered = fallbackCatalog.filter(
          (cg: any) => !ownedCatalogIds.has(cg.id) && cg.id !== sourceGame.catalog_id
        );
        allDiscoveryScored = filtered.map((cg: any) => {
          const libCount = popularityMap.get(cg.id) || 0;
          return {
            id: cg.id,
            title: cg.title,
            slug: cg.slug,
            image_url: cg.image_url,
            difficulty: weightToLabel(cg.weight),
            play_time: cg.play_time_minutes ? `${cg.play_time_minutes} min` : null,
            min_players: cg.min_players,
            max_players: cg.max_players,
            reason: "Similar complexity and player count",
            score: 1,
            library_count: libCount,
            normalized_mechanic_score: 0,
          };
        });
      }
    }

    // ── STRATEGY 3: Diversity Slot Reservation ──
    // Reserve 1-2 slots for low-popularity gems (below 25th percentile)
    const diversitySlots = limit >= 5 ? 2 : 1;
    const mainSlots = limit - diversitySlots;

    const lowPopGems = allDiscoveryScored.filter(
      (g) => (g.library_count || 0) <= p25 && g.score > 0
    );
    const regularPool = allDiscoveryScored.filter(
      (g) => (g.library_count || 0) > p25
    );

    // ── STRATEGY 4: Random sampling from qualified pool ──
    // Instead of deterministic top-N, randomly sample from top-20
    const sampledRegular = weightedRandomSample(regularPool.slice(0, 20), mainSlots);
    const sampledDiversity = weightedRandomSample(lowPopGems.slice(0, 10), diversitySlots);

    // Combine: regular picks + diversity picks
    const discoveries = [...sampledRegular, ...sampledDiversity].slice(0, limit);

    // ── Optional AI re-ranking via Cortex ──
    const AI_RERANK_URL = Deno.env.get("AI_RERANK_URL") || "https://cortex.tzolak.com/api/recommend";
    let rerankedDiscoveries = discoveries;
    let rerankedCollectionMatches = collectionMatches;

    console.log(`[recommendations] AI_RERANK_URL=${AI_RERANK_URL}, discoveries=${discoveries.length}, collection=${collectionMatches.length}`);

    if (AI_RERANK_URL && (discoveries.length > 0 || collectionMatches.length > 0)) {
      try {
        console.log("[recommendations] Calling Cortex AI re-ranker...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const aiPayload = {
          source_game: {
            title: sourceGame.title,
            description: sourceGame.description || null,
            difficulty: sourceGame.difficulty,
            play_time: sourceGame.play_time,
            game_type: sourceGame.game_type,
            min_players: sourceMinPlayers,
            max_players: sourceMaxPlayers,
            mechanics: sourceMechanics.map((m: any) => m.name),
          },
          discoveries: discoveries.map((g) => ({
            id: g.id,
            title: g.title,
            difficulty: g.difficulty,
            play_time: g.play_time,
            min_players: g.min_players,
            max_players: g.max_players,
            reason: g.reason,
            score: g.score,
          })),
          collection_matches: collectionMatches.map((g) => ({
            id: g.id,
            title: g.title,
            difficulty: g.difficulty,
            play_time: g.play_time,
            min_players: g.min_players,
            max_players: g.max_players,
            reason: g.reason,
            score: g.score,
          })),
        };

        const aiResponse = await fetch(AI_RERANK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(aiPayload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        console.log(`[recommendations] Cortex responded: ${aiResponse.status}`);

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          console.log(`[recommendations] AI returned: discoveries=${aiData.discoveries?.length ?? 0}, collection=${aiData.collection_matches?.length ?? 0}`);
          if (aiData.discoveries && Array.isArray(aiData.discoveries)) {
            rerankedDiscoveries = mergeAiResults(discoveries, aiData.discoveries);
          }
          if (aiData.collection_matches && Array.isArray(aiData.collection_matches)) {
            rerankedCollectionMatches = mergeAiResults(collectionMatches, aiData.collection_matches);
          }
          console.log("[recommendations] AI re-rank applied successfully");
        } else {
          const errText = await aiResponse.text();
          console.warn(`[recommendations] AI re-rank returned ${aiResponse.status}: ${errText}`);
        }
      } catch (aiErr) {
        console.warn("[recommendations] AI re-rank failed:", aiErr instanceof Error ? `${aiErr.name}: ${aiErr.message}` : aiErr);
      }
    } else {
      console.log("[recommendations] Skipping AI re-rank (no URL or no results)");
    }

    // ── Research Logging: Diversity & Bias Metrics ──
    try {
      const discoveryLibCounts = rerankedDiscoveries.map((g) => g.library_count || 0);
      const avgDiscoveryPopularity = discoveryLibCounts.length > 0
        ? discoveryLibCounts.reduce((a, b) => a + b, 0) / discoveryLibCounts.length
        : 0;
      const diversityCount = rerankedDiscoveries.filter(
        (g) => (g.library_count || 0) <= p25
      ).length;

      const biasMetrics = {
        source_game: sourceGame.title,
        source_catalog_id: sourceGame.catalog_id,
        total_candidates: allDiscoveryScored.length,
        low_pop_candidates: lowPopGems.length,
        regular_candidates: regularPool.length,
        discoveries_returned: rerankedDiscoveries.length,
        collection_matches_returned: rerankedCollectionMatches.length,
        diversity_slots_filled: diversityCount,
        avg_discovery_library_count: Math.round(avgDiscoveryPopularity * 10) / 10,
        median_catalog_library_count: medianCount,
        p25_threshold: p25,
        max_library_count: maxCount,
        discovery_titles: rerankedDiscoveries.map((g) => ({
          title: g.title,
          library_count: g.library_count || 0,
          score: g.score,
          normalized_mechanic: g.normalized_mechanic_score || 0,
        })),
        ai_reranked: AI_RERANK_URL ? true : false,
      };

      console.log(`[recommendations] Bias metrics: avg_pop=${biasMetrics.avg_discovery_library_count}, diversity_slots=${diversityCount}/${diversitySlots}, candidates=${allDiscoveryScored.length}`);

      // Fire-and-forget log to system_logs
      supabase
        .from("system_logs")
        .insert({
          level: "info",
          source: "recommendations",
          message: `Recommendation batch for "${sourceGame.title}" — diversity: ${diversityCount}/${diversitySlots}, avg_pop: ${biasMetrics.avg_discovery_library_count}`,
          metadata: biasMetrics,
          library_id: library_id,
        })
        .then(() => {});
    } catch (logErr) {
      console.warn("[recommendations] Metrics logging failed:", logErr);
    }

    return new Response(
      JSON.stringify({
        discoveries: rerankedDiscoveries,
        collection_matches: rerankedCollectionMatches,
        recommendations: [...rerankedDiscoveries, ...rerankedCollectionMatches].slice(0, limit),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Recommendations error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to get recommendations" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ── Scoring with anti-popularity-bias ──

function scoreGames(
  games: any[],
  sourceFamilyIds: Set<string>,
  sourceMechanicIds: Set<string>,
  sourceMinPlayers: number,
  sourceMaxPlayers: number,
  sourceWeight: number | null,
  sourcePlayTime: number | null,
  popularityMap: Map<string, number>,
  maxLibraryCount: number,
  source: "library" | "catalog"
): ScoredGame[] {
  return games
    .map((g: any) => {
      const mechanics = (g.game_mechanics || [])
        .map((gm: any) => gm.mechanic)
        .filter(Boolean);
      const familyIds = new Set(mechanics.map((m: any) => m.family_id).filter(Boolean));
      const mechanicIds = new Set(mechanics.map((m: any) => m.id).filter(Boolean));

      // Family overlap (strongest signal, worth 5 points each)
      let familyOverlap = 0;
      for (const fid of familyIds) {
        if (sourceFamilyIds.has(fid)) familyOverlap++;
      }

      // Exact mechanic overlap (worth 2 points each)
      let mechanicOverlap = 0;
      for (const mid of mechanicIds) {
        if (sourceMechanicIds.has(mid)) mechanicOverlap++;
      }

      // ── STRATEGY 2: Normalized mechanic scoring ──
      // Divide overlap by candidate's total mechanics to prevent well-tagged
      // popular games from dominating just because they have more tags
      const totalCandidateMechanics = mechanicIds.size || 1;
      const normalizedMechanicScore = (familyOverlap * 5 + mechanicOverlap * 2) / totalCandidateMechanics;

      // Player count overlap (0-3 points)
      const gMin = g.min_players || 1;
      const gMax = g.max_players || 4;
      const overlapMin = Math.max(sourceMinPlayers, gMin);
      const overlapMax = Math.min(sourceMaxPlayers, gMax);
      const playerOverlap = Math.max(0, Math.min(3, overlapMax - overlapMin + 1));

      // Weight similarity (0-3 points)
      let weightScore = 0;
      if (sourceWeight !== null && g.difficulty) {
        const gWeight = labelToWeight(g.difficulty);
        if (gWeight !== null) {
          const diff = Math.abs(sourceWeight - gWeight);
          weightScore = diff < 0.5 ? 3 : diff < 1.0 ? 2 : diff < 1.5 ? 1 : 0;
        }
      }

      // ── STRATEGY 1: Inverse popularity weighting ──
      // Games owned by fewer libraries get a scoring boost (0-5 points)
      // Uses log scale so the boost decays smoothly
      const catalogId = g.catalog_id || g.id;
      const libCount = popularityMap.get(catalogId) || 0;
      let popularityBonus = 0;
      if (source === "catalog" && maxLibraryCount > 0) {
        // Inverse log: rare games (low library_count) get up to 5 bonus points
        // Popular games (high library_count) get 0
        const popularityRatio = libCount / maxLibraryCount;
        popularityBonus = Math.round(5 * (1 - Math.sqrt(popularityRatio)));
      }

      // Use normalized mechanic score instead of raw overlap
      const totalScore = Math.round(normalizedMechanicScore * 3) + playerOverlap + weightScore + popularityBonus;

      // Build reason
      const reasons: string[] = [];
      if (familyOverlap > 0 || mechanicOverlap > 0) {
        const sharedNames = mechanics
          .filter((m: any) => sourceMechanicIds.has(m.id) || sourceFamilyIds.has(m.family_id))
          .map((m: any) => m.name)
          .slice(0, 3);
        if (sharedNames.length > 0) reasons.push(`Shares: ${sharedNames.join(", ")}`);
      }
      if (playerOverlap >= 2) reasons.push("Similar player count");
      if (weightScore >= 2) reasons.push("Similar complexity");
      if (popularityBonus >= 3) reasons.push("Hidden gem");
      if (reasons.length === 0) reasons.push(source === "catalog" ? "You might enjoy this" : "In your collection");

      return {
        id: g.id,
        title: g.title,
        slug: g.slug,
        image_url: g.image_url,
        difficulty: g.difficulty,
        play_time: g.play_time,
        min_players: g.min_players,
        max_players: g.max_players,
        reason: reasons.join(" · "),
        score: totalScore,
        library_count: libCount,
        normalized_mechanic_score: Math.round(normalizedMechanicScore * 100) / 100,
      };
    })
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * STRATEGY 4: Weighted random sampling from a qualified pool.
 * Instead of deterministic top-N, randomly samples from the pool
 * with probability proportional to score. This adds serendipity
 * and prevents the same popular games from always appearing.
 */
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

function labelToWeight(label: string): number | null {
  const map: Record<string, number> = {
    light: 1.0,
    "medium light": 2.0,
    medium: 3.0,
    "medium heavy": 3.75,
    heavy: 4.5,
  };
  return map[label.toLowerCase()] ?? null;
}

/**
 * Merge AI re-ranked results back onto the full game objects.
 * AI returns ordered IDs with optional enhanced reasons.
 * Falls back to original order for any IDs not in the AI response.
 */
function mergeAiResults(
  originals: ScoredGame[],
  aiList: Array<{ id: string; reason?: string }>
): ScoredGame[] {
  const origMap = new Map(originals.map((g) => [g.id, g]));
  const merged: ScoredGame[] = [];
  const seen = new Set<string>();

  for (const aiItem of aiList) {
    const orig = origMap.get(aiItem.id);
    if (orig) {
      merged.push({
        ...orig,
        reason: aiItem.reason || orig.reason,
      });
      seen.add(aiItem.id);
    }
  }

  for (const orig of originals) {
    if (!seen.has(orig.id)) {
      merged.push(orig);
    }
  }

  return merged;
}


if (import.meta.main) {
  Deno.serve(handler);
}
