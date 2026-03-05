import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

// ─── Gaming Personality Archetypes ───
// Each trigger has an optional weight multiplier (default 1).
// Higher-weight triggers are stronger signals for that archetype.
interface TriggerDef {
  mechanic: string;
  weight: number; // 1 = normal, 2 = strong, 3 = definitive
}

function t(mechanic: string, weight = 1): TriggerDef {
  return { mechanic, weight };
}

export const ARCHETYPES = [
  {
    id: "strategist",
    name: "The Grand Strategist",
    emoji: "🏰",
    description: "You thrive on deep strategy, resource management, and outmaneuvering opponents through careful planning.",
    triggers: [t("Worker Placement", 3), t("Area Control", 2), t("Engine Building"), t("Resource Management"), t("Route Building", 2)],
    minWeight: 3.0,
  },
  {
    id: "socializer",
    name: "The Social Butterfly",
    emoji: "🎭",
    description: "Games are about the people! You love negotiation, bluffing, and the chaos of social interaction.",
    triggers: [t("Negotiation", 3), t("Bluffing", 2), t("Trading", 2), t("Voting"), t("Team-Based Game", 2), t("Communication Limits"), t("Roles with Asymmetric Information")],
    minWeight: 0,
  },
  {
    id: "explorer",
    name: "The Adventurer",
    emoji: "🗺️",
    description: "You seek discovery and narrative. Every game is a journey into the unknown.",
    triggers: [t("Exploration", 3), t("Narrative", 2), t("Campaign", 2), t("Legacy", 3), t("Storytelling"), t("Adventure"), t("Pick-up and Deliver")],
    minWeight: 0,
  },
  {
    id: "tactician",
    name: "The Tactician",
    emoji: "⚔️",
    description: "Quick thinking and spatial awareness define your play style. You read the board like a battlefield.",
    triggers: [t("Area Majority", 3), t("Grid Movement", 2), t("Dice Rolling"), t("Hand Management"), t("Modular Board", 2), t("Hexagon Grid", 2)],
    minWeight: 2.0,
  },
  {
    id: "builder",
    name: "The Architect",
    emoji: "🏗️",
    description: "You love constructing complex systems and watching your engine purr. Efficiency is your art form.",
    triggers: [t("Engine Building", 3), t("Deck Building", 2), t("Tableau Building", 2), t("Network Building", 2), t("Tile Placement"), t("Pattern Building")],
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
    triggers: [t("Player Elimination", 2), t("Take That", 2), t("Racing", 2), t("Betting and Bluffing"), t("Auction/Bidding", 2)],
    minWeight: 0,
  },
  {
    id: "thinker",
    name: "The Puzzle Master",
    emoji: "🧩",
    description: "Complex puzzles and optimization problems are your playground. You love the crunch.",
    triggers: [t("Puzzle", 3), t("Deduction", 2), t("Logic", 2), t("Pattern Recognition"), t("Set Collection"), t("Connections")],
    minWeight: 2.5,
  },
  {
    id: "diplomat",
    name: "The Diplomat",
    emoji: "🤝",
    description: "Cooperation over competition. You believe the best games are won together, not against each other.",
    triggers: [t("Cooperative Game", 3), t("Solo / Cooperative Mode", 2), t("Team-Based Game", 2), t("Variable Player Powers"), t("Communication Limits")],
    minWeight: 0,
  },
  {
    id: "entertainer",
    name: "The Entertainer",
    emoji: "🎪",
    description: "You bring the fun! Party games, real-time chaos, and laugh-out-loud moments are your specialty.",
    triggers: [t("Party Game", 3), t("Real-Time", 2), t("Dexterity", 2), t("Acting", 2), t("Singing", 2), t("Trivia")],
    minWeight: 0,
  },
  {
    id: "europurist",
    name: "The Euro Purist",
    emoji: "⚗️",
    description: "Low luck, tight economies, and elegant mechanisms. You appreciate the craft of game design at its finest.",
    triggers: [t("Action Drafting", 3), t("Market", 2), t("Income", 2), t("Variable Phase Order", 2), t("Rondel", 3), t("Action Points")],
    minWeight: 3.5,
  },
] as const;

export type ArchetypeId = typeof ARCHETYPES[number]["id"];

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

export interface PersonalitySplit {
  blended: GamingPersonality;
  shelf: GamingPersonality;
  play: GamingPersonality | null; // null if no play data
  hasPlayData: boolean;
}

export interface RareGame {
  title: string;
  ownerCount: number;
}

export interface CollectionRarity {
  uniqueGamesCount: number;
  rareGamesCount: number;
  totalLibrariesOnPlatform: number;
  rarityPercentile: number;
  uniqueGames: RareGame[];
  rareGames: RareGame[];
}

export interface CollectionIntelligence {
  personality: GamingPersonality;
  personalitySplit: PersonalitySplit;
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

// ─── Scoring engine ───
function scoreArchetypes(
  mechanicDNA: MechanicDNA[],
  avgWeight: number,
): { primary: typeof ARCHETYPES[number]; secondary: typeof ARCHETYPES[number] | null; confidence: number; scores: Map<string, number> } {
  const archetypeScores = ARCHETYPES.map(arch => {
    let score = 0;
    arch.triggers.forEach((trigger: TriggerDef) => {
      const tLower = trigger.mechanic.toLowerCase();
      mechanicDNA.forEach(m => {
        if (m.name.toLowerCase().includes(tLower) || tLower.includes(m.name.toLowerCase())) {
          score += m.count * trigger.weight;
        }
      });
    });
    return { archetype: arch, score };
  });

  // Weight bonus
  archetypeScores.forEach(as => {
    if (as.archetype.minWeight > 0 && avgWeight >= as.archetype.minWeight) {
      as.score *= 1.3;
    }
  });

  archetypeScores.sort((a, b) => b.score - a.score);

  const topScore = archetypeScores[0]?.score || 0;
  const primary = topScore > 0 ? archetypeScores[0].archetype : ARCHETYPES.find(a => a.id === "collector")!;
  const secondary = archetypeScores[1]?.score > 0 ? archetypeScores[1].archetype : null;
  const totalMechanics = mechanicDNA.reduce((s, m) => s + m.count, 0) || 1;
  const confidence = Math.min(100, Math.round((topScore / Math.max(totalMechanics, 1)) * 100));

  const scores = new Map<string, number>();
  archetypeScores.forEach(as => scores.set(as.archetype.id, as.score));

  return { primary, secondary, confidence, scores };
}

function buildMechanicDNA(mechanicPairs: { name: string; count: number }[], totalGames: number): MechanicDNA[] {
  return mechanicPairs
    .map(({ name, count }) => ({
      name,
      count,
      percentage: Math.round((count / Math.max(totalGames, 1)) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export function useCollectionIntelligence(libraryId: string | null) {
  return useQuery({
    queryKey: ["collection-intelligence", libraryId],
    queryFn: async (): Promise<CollectionIntelligence | null> => {
      if (!libraryId) return null;

      // 1. Fetch all owned games
      const { data: games, error: gErr } = await (supabase
        .from("games")
        .select("id, title, min_players, max_players, difficulty, game_type, is_expansion, is_unplayed, ownership_status, year_published, created_at, catalog_id, catalog:game_catalog(weight)")
        .eq("library_id", libraryId)
        .eq("ownership_status", "owned") as any);

      if (gErr) throw gErr;
      if (!games || games.length === 0) return null;

      const baseGames = games.filter((g: any) => !g.is_expansion);
      const expansions = games.filter((g: any) => g.is_expansion);

      // 2. Fetch mechanics for base games
      const gameIds = baseGames.map((g: any) => g.id);
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

      // 3. Fetch play session counts per game
      const sessionCounts = new Map<string, number>();
      for (let i = 0; i < gameIds.length; i += BATCH) {
        const batch = gameIds.slice(i, i + BATCH);
        const { data: sessions } = await supabase
          .from("game_sessions")
          .select("game_id")
          .in("game_id", batch);
        if (sessions) {
          sessions.forEach((s: any) => {
            sessionCounts.set(s.game_id, (sessionCounts.get(s.game_id) || 0) + 1);
          });
        }
      }

      const hasPlayData = sessionCounts.size > 0;

      // 4. Compute mechanic DNA — shelf-based (all games equal)
      const shelfMechanicCounts = new Map<string, number>();
      allMechanics.forEach(gm => {
        if (gm.mechanic?.name) {
          shelfMechanicCounts.set(gm.mechanic.name, (shelfMechanicCounts.get(gm.mechanic.name) || 0) + 1);
        }
      });
      const shelfMechanicDNA = buildMechanicDNA(
        Array.from(shelfMechanicCounts.entries()).map(([name, count]) => ({ name, count })),
        baseGames.length
      );

      // 5. Compute play-weighted mechanic DNA
      // Games with sessions get multiplied: base 1 + log2(sessions) bonus
      // Unplayed games get 0.5x penalty
      const playMechanicCounts = new Map<string, number>();
      const playOnlyMechanicCounts = new Map<string, number>(); // only played games
      allMechanics.forEach(gm => {
        if (gm.mechanic?.name) {
          const sessions = sessionCounts.get(gm.game_id) || 0;
          const playMultiplier = sessions > 0
            ? 1 + Math.log2(sessions + 1) // e.g. 1 session=2x, 3 sessions=2.6x, 10 sessions=3.5x
            : 0.5; // unplayed penalty
          const weighted = playMultiplier;
          playMechanicCounts.set(gm.mechanic.name, (playMechanicCounts.get(gm.mechanic.name) || 0) + weighted);

          if (sessions > 0) {
            playOnlyMechanicCounts.set(gm.mechanic.name, (playOnlyMechanicCounts.get(gm.mechanic.name) || 0) + sessions);
          }
        }
      });

      const blendedMechanicDNA = buildMechanicDNA(
        Array.from(playMechanicCounts.entries()).map(([name, count]) => ({ name, count: Math.round(count) })),
        baseGames.length
      );

      const playOnlyDNA = buildMechanicDNA(
        Array.from(playOnlyMechanicCounts.entries()).map(([name, count]) => ({ name, count })),
        sessionCounts.size || 1
      );

      // 6. Weight calculations
      const weights = baseGames.map((g: any) => g.catalog?.weight).filter((w: any): w is number => w != null && w > 0);
      const avgWeight = weights.length > 0 ? weights.reduce((s: number, w: number) => s + w, 0) / weights.length : 0;

      // 7. Score all three perspectives
      const shelfResult = scoreArchetypes(shelfMechanicDNA, avgWeight);
      const blendedResult = scoreArchetypes(blendedMechanicDNA, avgWeight);
      const playResult = hasPlayData ? scoreArchetypes(playOnlyDNA, avgWeight) : null;

      const personalitySplit: PersonalitySplit = {
        blended: { archetype: blendedResult.primary, secondaryArchetype: blendedResult.secondary, confidence: blendedResult.confidence },
        shelf: { archetype: shelfResult.primary, secondaryArchetype: shelfResult.secondary, confidence: shelfResult.confidence },
        play: playResult ? { archetype: playResult.primary, secondaryArchetype: playResult.secondary, confidence: playResult.confidence } : null,
        hasPlayData,
      };

      // Primary personality = blended (play-weighted)
      const personality = personalitySplit.blended;

      // 8. Save snapshot (fire-and-forget, once per month)
      const currentMonth = new Date().toISOString().slice(0, 7); // '2026-03'
      supabase
        .from("archetype_snapshots")
        .upsert({
          library_id: libraryId,
          snapshot_month: currentMonth,
          source: "blended",
          primary_archetype: personality.archetype.id,
          secondary_archetype: personality.secondaryArchetype?.id || null,
          confidence: personality.confidence,
        }, { onConflict: "library_id,snapshot_month,source" })
        .then(() => {});

      // Also save shelf snapshot
      supabase
        .from("archetype_snapshots")
        .upsert({
          library_id: libraryId,
          snapshot_month: currentMonth,
          source: "shelf",
          primary_archetype: shelfResult.primary.id,
          secondary_archetype: shelfResult.secondary?.id || null,
          confidence: shelfResult.confidence,
        }, { onConflict: "library_id,snapshot_month,source" })
        .then(() => {});

      if (playResult) {
        supabase
          .from("archetype_snapshots")
          .upsert({
            library_id: libraryId,
            snapshot_month: currentMonth,
            source: "play",
            primary_archetype: playResult.primary.id,
            secondary_archetype: playResult.secondary?.id || null,
            confidence: playResult.confidence,
          }, { onConflict: "library_id,snapshot_month,source" })
          .then(() => {});
      }

      // 9. Categories / game types
      const typeCounts = new Map<string, number>();
      baseGames.forEach((g: any) => {
        const t = g.game_type || "Unknown";
        typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
      });
      const topCategories = Array.from(typeCounts.entries())
        .map(([name, count]) => ({ name: name.replace(/_/g, " "), count, percentage: Math.round((count / baseGames.length) * 100) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // 10. Player count sweet spot
      const playerMaxes = baseGames.map((g: any) => g.max_players).filter((p: any): p is number => p != null && p > 0);
      const playerMins = baseGames.map((g: any) => g.min_players).filter((p: any): p is number => p != null && p > 0);
      const avgMin = playerMins.length > 0 ? Math.round(playerMins.reduce((s: number, p: number) => s + p, 0) / playerMins.length) : 1;
      const avgMax = playerMaxes.length > 0 ? Math.round(playerMaxes.reduce((s: number, p: number) => s + p, 0) / playerMaxes.length) : 4;
      const sweetSpotPlayers = avgMin === avgMax ? `${avgMin}` : `${avgMin}–${avgMax}`;

      // 11. Shelf of shame
      const unplayedCount = baseGames.filter((g: any) => g.is_unplayed).length;
      const shelfPercent = baseGames.length > 0 ? Math.round((unplayedCount / baseGames.length) * 100) : 0;

      // 12. Weight label
      const weightLabel = avgWeight >= 4 ? "Brain Burner" : avgWeight >= 3 ? "Heavy Thinker" : avgWeight >= 2 ? "Medium Weight" : avgWeight >= 1 ? "Gateway Gamer" : "Unknown";

      // 13. Decade spread
      const decades = new Map<string, number>();
      baseGames.forEach((g: any) => {
        if (g.year_published && g.year_published > 1900) {
          const decade = `${Math.floor(g.year_published / 10) * 10}s`;
          decades.set(decade, (decades.get(decade) || 0) + 1);
        }
      });
      const decadeSpread = Array.from(decades.entries())
        .map(([decade, count]) => ({ decade, count }))
        .sort((a, b) => a.decade.localeCompare(b.decade));

      // 14. Oldest/newest
      const withYears = baseGames.filter((g: any) => g.year_published && g.year_published > 1900);
      withYears.sort((a: any, b: any) => (a.year_published || 0) - (b.year_published || 0));
      const oldestGame = withYears.length > 0 ? { title: withYears[0].title, year: withYears[0].year_published! } : null;
      const newestGame = withYears.length > 0 ? { title: withYears[withYears.length - 1].title, year: withYears[withYears.length - 1].year_published! } : null;

      // 15. Rarity score
      let rarity: CollectionRarity | null = null;
      const catalogIds = baseGames.map((g: any) => g.catalog_id).filter((c: any): c is string => !!c);

      if (catalogIds.length > 0) {
        const RARITY_BATCH = 50;
        const ownershipMap = new Map<string, number>();
        const titleMap = new Map<string, string>();

        baseGames.forEach((g: any) => {
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
            const libSets = new Map<string, Set<string>>();
            ownerData.forEach((row: any) => {
              if (!row.catalog_id) return;
              if (!libSets.has(row.catalog_id)) libSets.set(row.catalog_id, new Set());
              libSets.get(row.catalog_id)!.add(row.library_id);
            });
            libSets.forEach((libs, catId) => ownershipMap.set(catId, libs.size));
          }
        }

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
        personality,
        personalitySplit,
        mechanicDNA: blendedMechanicDNA.slice(0, 12),
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
