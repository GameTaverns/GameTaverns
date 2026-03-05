import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

// ─── Gaming Personality Archetypes ───
// Based on dominant mechanics/weight patterns
const ARCHETYPES = [
  {
    id: "strategist",
    name: "The Grand Strategist",
    emoji: "🏰",
    description: "You thrive on deep strategy, resource management, and outmaneuvering opponents through careful planning.",
    triggers: ["Worker Placement", "Area Control", "Engine Building", "Resource Management", "Route Building"],
    minWeight: 3.0,
  },
  {
    id: "socializer",
    name: "The Social Butterfly",
    emoji: "🎭",
    description: "Games are about the people! You love negotiation, bluffing, and the chaos of social interaction.",
    triggers: ["Negotiation", "Bluffing", "Trading", "Voting", "Team-Based Game", "Communication Limits", "Roles with Asymmetric Information"],
    minWeight: 0,
  },
  {
    id: "explorer",
    name: "The Adventurer",
    emoji: "🗺️",
    description: "You seek discovery and narrative. Every game is a journey into the unknown.",
    triggers: ["Exploration", "Narrative", "Campaign", "Legacy", "Storytelling", "Adventure", "Pick-up and Deliver"],
    minWeight: 0,
  },
  {
    id: "tactician",
    name: "The Tactician",
    emoji: "⚔️",
    description: "Quick thinking and spatial awareness define your play style. You read the board like a battlefield.",
    triggers: ["Area Majority", "Grid Movement", "Dice Rolling", "Hand Management", "Modular Board", "Hexagon Grid"],
    minWeight: 2.0,
  },
  {
    id: "builder",
    name: "The Architect",
    emoji: "🏗️",
    description: "You love constructing complex systems and watching your engine purr. Efficiency is your art form.",
    triggers: ["Engine Building", "Deck Building", "Tableau Building", "Network Building", "Tile Placement", "Pattern Building"],
    minWeight: 2.0,
  },
  {
    id: "collector",
    name: "The Curator",
    emoji: "🎲",
    description: "Breadth over depth — your shelf is eclectic, wide-ranging, and full of surprises.",
    triggers: [], // Fallback: many categories, low mechanic concentration
    minWeight: 0,
  },
  {
    id: "competitor",
    name: "The Gladiator",
    emoji: "🏆",
    description: "You live for the thrill of competition. Head-to-head, winner-takes-all — bring it on.",
    triggers: ["Player Elimination", "Take That", "Racing", "Betting and Bluffing", "Auction/Bidding"],
    minWeight: 0,
  },
  {
    id: "thinker",
    name: "The Puzzle Master",
    emoji: "🧩",
    description: "Complex puzzles and optimization problems are your playground. You love the crunch.",
    triggers: ["Puzzle", "Deduction", "Logic", "Pattern Recognition", "Set Collection", "Connections"],
    minWeight: 2.5,
  },
] as const;

export interface MechanicDNA {
  name: string;
  count: number;
  percentage: number;
}

export interface GamingPersonality {
  archetype: typeof ARCHETYPES[number];
  secondaryArchetype: typeof ARCHETYPES[number] | null;
  confidence: number; // 0-100 how strong the match
}

export interface RareGame {
  title: string;
  ownerCount: number; // how many libraries own this
}

export interface CollectionRarity {
  uniqueGamesCount: number; // games only in this library
  rareGamesCount: number;   // games in <= 3 libraries
  totalLibrariesOnPlatform: number;
  rarityPercentile: number; // 0-100: how unique your collection is vs avg
  uniqueGames: RareGame[];  // list of unique/rare titles
  rareGames: RareGame[];
}

export interface CollectionIntelligence {
  personality: GamingPersonality;
  mechanicDNA: MechanicDNA[];
  avgWeight: number;
  weightLabel: string;
  topCategories: { name: string; count: number; percentage: number }[];
  shelfOfShamePercent: number;
  shelfOfShameCount: number;
  totalGames: number;
  totalExpansions: number;
  avgPlayerCount: { min: number; max: number };
  sweetSpotPlayers: string;
  oldestGame: { title: string; year: number } | null;
  newestGame: { title: string; year: number } | null;
  decadeSpread: { decade: string; count: number }[];
  rarity: CollectionRarity | null;
}

export function useCollectionIntelligence(libraryId: string | null) {
  return useQuery({
    queryKey: ["collection-intelligence", libraryId],
    queryFn: async (): Promise<CollectionIntelligence | null> => {
      if (!libraryId) return null;

      // 1. Fetch all owned games (weight lives on game_catalog via catalog_id)
      const { data: games, error: gErr } = await (supabase
        .from("games")
        .select("id, title, min_players, max_players, difficulty, game_type, is_expansion, is_unplayed, ownership_status, year_published, created_at, catalog:game_catalog(weight)")
        .eq("library_id", libraryId)
        .eq("ownership_status", "owned") as any);

      if (gErr) throw gErr;
      if (!games || games.length === 0) return null;

      const baseGames = games.filter(g => !g.is_expansion);
      const expansions = games.filter(g => g.is_expansion);

      // 2. Fetch mechanics for these games
      const gameIds = baseGames.map(g => g.id);
      const BATCH = 50;
      const allMechanics: { game_id: string; mechanic: { id: string; name: string } | null }[] = [];

      for (let i = 0; i < gameIds.length; i += BATCH) {
        const batch = gameIds.slice(i, i + BATCH);
        const { data } = await supabase
          .from("game_mechanics")
          .select("game_id, mechanic:mechanics(id, name)")
          .in("game_id", batch);
        if (data) allMechanics.push(...(data as any));
      }

      // 3. Compute mechanic DNA
      const mechanicCounts = new Map<string, number>();
      allMechanics.forEach(gm => {
        if (gm.mechanic?.name) {
          mechanicCounts.set(gm.mechanic.name, (mechanicCounts.get(gm.mechanic.name) || 0) + 1);
        }
      });

      const totalMechanicAssignments = Array.from(mechanicCounts.values()).reduce((s, c) => s + c, 0) || 1;
      const mechanicDNA: MechanicDNA[] = Array.from(mechanicCounts.entries())
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / baseGames.length) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      // 4. Determine gaming personality
      const archetypeScores = ARCHETYPES.map(arch => {
        let score = 0;
        const triggers = arch.triggers as readonly string[];
        triggers.forEach(trigger => {
          const tLower = trigger.toLowerCase();
          mechanicDNA.forEach(m => {
            if (m.name.toLowerCase().includes(tLower) || tLower.includes(m.name.toLowerCase())) {
              score += m.count;
            }
          });
        });
        return { archetype: arch, score };
      });

      // Weight bonus
      const weights = baseGames.map((g: any) => g.catalog?.weight).filter((w: any): w is number => w != null && w > 0);
      const avgWeight = weights.length > 0 ? weights.reduce((s: number, w: number) => s + w, 0) / weights.length : 0;

      archetypeScores.forEach(as => {
        if (as.archetype.minWeight > 0 && avgWeight >= as.archetype.minWeight) {
          as.score *= 1.3; // Weight bonus
        }
      });

      archetypeScores.sort((a, b) => b.score - a.score);

      // Fallback to curator if no strong match
      const topScore = archetypeScores[0]?.score || 0;
      let primary = topScore > 0 ? archetypeScores[0].archetype : ARCHETYPES.find(a => a.id === "collector")!;
      let secondary = archetypeScores[1]?.score > 0 ? archetypeScores[1].archetype : null;
      const maxPossibleScore = baseGames.length * 3;
      const confidence = Math.min(100, Math.round((topScore / Math.max(maxPossibleScore, 1)) * 100 * 3));

      // 5. Categories / game types
      const typeCounts = new Map<string, number>();
      baseGames.forEach(g => {
        const t = g.game_type || "Unknown";
        typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
      });
      const topCategories = Array.from(typeCounts.entries())
        .map(([name, count]) => ({ name: name.replace(/_/g, " "), count, percentage: Math.round((count / baseGames.length) * 100) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // 6. Player count sweet spot
      const playerMaxes = baseGames.map(g => g.max_players).filter((p): p is number => p != null && p > 0);
      const playerMins = baseGames.map(g => g.min_players).filter((p): p is number => p != null && p > 0);
      const avgMin = playerMins.length > 0 ? Math.round(playerMins.reduce((s, p) => s + p, 0) / playerMins.length) : 1;
      const avgMax = playerMaxes.length > 0 ? Math.round(playerMaxes.reduce((s, p) => s + p, 0) / playerMaxes.length) : 4;
      const sweetSpotPlayers = avgMin === avgMax ? `${avgMin}` : `${avgMin}–${avgMax}`;

      // 7. Shelf of shame
      const unplayedCount = baseGames.filter(g => g.is_unplayed).length;
      const shelfPercent = baseGames.length > 0 ? Math.round((unplayedCount / baseGames.length) * 100) : 0;

      // 8. Weight label
      const weightLabel = avgWeight >= 4 ? "Brain Burner" : avgWeight >= 3 ? "Heavy Thinker" : avgWeight >= 2 ? "Medium Weight" : avgWeight >= 1 ? "Gateway Gamer" : "Unknown";

      // 9. Decade spread
      const decades = new Map<string, number>();
      baseGames.forEach(g => {
        if (g.year_published && g.year_published > 1900) {
          const decade = `${Math.floor(g.year_published / 10) * 10}s`;
          decades.set(decade, (decades.get(decade) || 0) + 1);
        }
      });
      const decadeSpread = Array.from(decades.entries())
        .map(([decade, count]) => ({ decade, count }))
        .sort((a, b) => a.decade.localeCompare(b.decade));

      // 10. Oldest/newest
      const withYears = baseGames.filter(g => g.year_published && g.year_published > 1900);
      withYears.sort((a, b) => (a.year_published || 0) - (b.year_published || 0));
      const oldestGame = withYears.length > 0 ? { title: withYears[0].title, year: withYears[0].year_published! } : null;
      const newestGame = withYears.length > 0 ? { title: withYears[withYears.length - 1].title, year: withYears[withYears.length - 1].year_published! } : null;

      // 11. Rarity score — find how many other libraries own the same catalog games
      let rarity: CollectionRarity | null = null;
      const catalogIds = baseGames.map(g => g.catalog_id).filter((c): c is string => !!c);

      if (catalogIds.length > 0) {
        // Count how many libraries own each catalog_id
        const RARITY_BATCH = 50;
        const ownershipMap = new Map<string, number>();
        const titleMap = new Map<string, string>();

        // Map catalog_id -> title from our games
        baseGames.forEach(g => {
          if (g.catalog_id) titleMap.set(g.catalog_id, g.title);
        });

        for (let i = 0; i < catalogIds.length; i += RARITY_BATCH) {
          const batch = catalogIds.slice(i, i + RARITY_BATCH);
          const { data: ownerData } = await supabase
            .from("games")
            .select("catalog_id, library_id")
            .in("catalog_id", batch)
            .eq("ownership_status", "owned");

          if (ownerData) {
            // Count distinct libraries per catalog_id
            const libSets = new Map<string, Set<string>>();
            ownerData.forEach((row: any) => {
              if (!row.catalog_id) return;
              if (!libSets.has(row.catalog_id)) libSets.set(row.catalog_id, new Set());
              libSets.get(row.catalog_id)!.add(row.library_id);
            });
            libSets.forEach((libs, catId) => ownershipMap.set(catId, libs.size));
          }
        }

        // Get total library count
        const { count: totalLibs } = await supabase
          .from("libraries")
          .select("id", { count: "exact", head: true });

        const uniqueGames: RareGame[] = [];
        const rareGames: RareGame[] = [];

        catalogIds.forEach(catId => {
          const ownerCount = ownershipMap.get(catId) || 1;
          const title = titleMap.get(catId) || "Unknown";
          if (ownerCount === 1) {
            uniqueGames.push({ title, ownerCount });
          } else if (ownerCount <= 3) {
            rareGames.push({ title, ownerCount });
          }
        });

        // Rarity percentile: what % of your collection is rare/unique
        const rarityPercentile = catalogIds.length > 0
          ? Math.round(((uniqueGames.length + rareGames.length) / catalogIds.length) * 100)
          : 0;

        rarity = {
          uniqueGamesCount: uniqueGames.length,
          rareGamesCount: rareGames.length,
          totalLibrariesOnPlatform: totalLibs || 0,
          rarityPercentile,
          uniqueGames: uniqueGames.slice(0, 5),
          rareGames: rareGames.sort((a, b) => a.ownerCount - b.ownerCount).slice(0, 5),
        };
      }

      return {
        personality: { archetype: primary, secondaryArchetype: secondary, confidence },
        mechanicDNA: mechanicDNA.slice(0, 12),
        avgWeight,
        weightLabel,
        topCategories,
        shelfOfShamePercent: shelfPercent,
        shelfOfShameCount: unplayedCount,
        totalGames: baseGames.length,
        totalExpansions: expansions.length,
        avgPlayerCount: { min: avgMin, max: avgMax },
        sweetSpotPlayers,
        oldestGame,
        newestGame,
        decadeSpread,
        rarity,
      };
    },
    enabled: !!libraryId,
    staleTime: 1000 * 60 * 10,
  });
}
