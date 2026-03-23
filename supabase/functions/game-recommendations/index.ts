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
}

/**
 * Algorithmic game recommendation engine.
 * Returns two lists:
 * - discoveries: Games from the global catalog that the user does NOT own
 * - collection_matches: Similar games already in the user's library
 *
 * Scoring is based on:
 * - Mechanic family overlap (strongest signal)
 * - Player count range overlap
 * - Weight/complexity similarity
 * - Play time similarity
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

    // ── SECTION 1: Collection Matches (games in user's library) ──
    const { data: libraryGames } = await supabase
      .from("games")
      .select(`
        id, title, slug, image_url, difficulty, play_time,
        min_players, max_players,
        game_mechanics(mechanic:mechanics(id, name, family_id))
      `)
      .eq("library_id", library_id)
      .neq("id", game_id)
      .eq("is_expansion", false)
      .eq("is_coming_soon", false)
      .limit(200);

    const collectionMatches: ScoredGame[] = scoreGames(
      libraryGames || [],
      sourceFamilyIds,
      sourceMechanicIds,
      sourceMinPlayers,
      sourceMaxPlayers,
      sourceWeight,
      sourcePlayTimeMinutes,
      "library"
    )
      .slice(0, limit);

    // ── SECTION 2: Discoveries (from global catalog, NOT owned) ──
    // Strategy: find catalog entries sharing mechanics with the source game
    let discoveries: ScoredGame[] = [];

    if (sourceMechanicIds.size > 0) {
      // Get catalog IDs that share mechanics with the source game
      const mechanicIdArray = Array.from(sourceMechanicIds);
      const { data: matchingCatalogMechanics } = await supabase
        .from("catalog_mechanics")
        .select("catalog_id")
        .in("mechanic_id", mechanicIdArray)
        .limit(500);

      if (matchingCatalogMechanics && matchingCatalogMechanics.length > 0) {
        // Deduplicate and exclude owned
        const candidateCatalogIds = [
          ...new Set(
            matchingCatalogMechanics
              .map((cm: any) => cm.catalog_id)
              .filter((cid: string) => !ownedCatalogIds.has(cid) && cid !== sourceGame.catalog_id)
          ),
        ].slice(0, 100); // cap for performance

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
            .limit(100);

          if (catalogGames) {
            // Map catalog games to the format scoreGames expects
            const mappedCatalogGames = catalogGames.map((cg: any) => ({
              id: cg.id,
              title: cg.title,
              slug: cg.slug,
              image_url: cg.image_url,
              difficulty: weightToLabel(cg.weight),
              play_time: cg.play_time_minutes ? `${cg.play_time_minutes} min` : null,
              min_players: cg.min_players,
              max_players: cg.max_players,
              game_mechanics: (cg.catalog_mechanics || []),
            }));

            discoveries = scoreGames(
              mappedCatalogGames,
              sourceFamilyIds,
              sourceMechanicIds,
              sourceMinPlayers,
              sourceMaxPlayers,
              sourceWeight,
              sourcePlayTimeMinutes,
              "catalog"
            )
              .slice(0, limit);
          }
        }
      }
    }

    // Fallback: if no mechanic-based discoveries, try weight/player-count similarity
    if (discoveries.length === 0 && sourceWeight !== null) {
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
        discoveries = filtered
          .map((cg: any) => ({
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
          }))
          .slice(0, limit);
      }
    }

    // ── Optional AI re-ranking via Cortex ──
    const AI_RERANK_URL = Deno.env.get("AI_RERANK_URL") || "https://cortex.tzolak.com/api/recommend";
    let rerankedDiscoveries = discoveries;
    let rerankedCollectionMatches = collectionMatches;

    if (AI_RERANK_URL && (discoveries.length > 0 || collectionMatches.length > 0)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

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

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.discoveries && Array.isArray(aiData.discoveries)) {
            rerankedDiscoveries = mergeAiResults(discoveries, aiData.discoveries);
          }
          if (aiData.collection_matches && Array.isArray(aiData.collection_matches)) {
            rerankedCollectionMatches = mergeAiResults(collectionMatches, aiData.collection_matches);
          }
          console.log("[recommendations] AI re-rank applied successfully");
        } else {
          console.warn(`[recommendations] AI re-rank returned ${aiResponse.status}, using algorithmic results`);
        }
      } catch (aiErr) {
        console.warn("[recommendations] AI re-rank unavailable, using algorithmic results:", aiErr instanceof Error ? aiErr.message : aiErr);
      }
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

// ── Scoring helpers ──

function scoreGames(
  games: any[],
  sourceFamilyIds: Set<string>,
  sourceMechanicIds: Set<string>,
  sourceMinPlayers: number,
  sourceMaxPlayers: number,
  sourceWeight: number | null,
  sourcePlayTime: number | null,
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

      const totalScore = familyOverlap * 5 + mechanicOverlap * 2 + playerOverlap + weightScore;

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
      };
    })
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score);
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

  // First: AI-ordered items
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

  // Then: any originals the AI didn't mention
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
