import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

// ─── Gaming Personality Archetypes (v3: Genre + Mechanic Family) ───
// Triggers support BOTH genre and mechanic family signals with equal weight.
// Mechanic matching uses family names only (~30 families, not ~250 raw mechanics).
interface TriggerDef {
  signal: string;
  type: "mechanic" | "genre";
  weight: number;
}

function m(family: string, weight = 1): TriggerDef {
  return { signal: family, type: "mechanic", weight };
}
function g(genre: string, weight = 1): TriggerDef {
  return { signal: genre, type: "genre", weight };
}

export const ARCHETYPES = [
  {
    id: "strategist",
    name: "The Grand Strategist",
    emoji: "🏰",
    description: "You thrive on deep strategy, resource management, and outmaneuvering opponents through careful planning.",
    triggers: [g("Strategy", 3), m("Worker Placement", 3), m("Area Control", 2), m("Engine Building"), m("Resource Management"), m("Route Building", 2)],
    minWeight: 3.0,
  },
  {
    id: "socializer",
    name: "The Social Butterfly",
    emoji: "🎭",
    description: "Games are about the people! You love negotiation, bluffing, and the chaos of social interaction.",
    triggers: [g("Party", 2), m("Negotiation", 3), m("Bluffing", 2), m("Trading", 2), m("Voting"), m("Team-Based Game", 2), m("Communication Limits"), m("Roles with Asymmetric Information")],
    minWeight: 0,
  },
  {
    id: "explorer",
    name: "The Adventurer",
    emoji: "🗺️",
    description: "You seek discovery and narrative. Every game is a journey into the unknown.",
    triggers: [g("Adventure", 3), m("Exploration", 3), m("Narrative", 2), m("Campaign", 2), m("Legacy", 3), m("Storytelling"), m("Pick-up and Deliver")],
    minWeight: 0,
  },
  {
    id: "tactician",
    name: "The Tactician",
    emoji: "⚔️",
    description: "Quick thinking and spatial awareness define your play style. You read the board like a battlefield.",
    triggers: [g("War", 2), m("Area Majority", 3), m("Grid Movement", 2), m("Dice", 2), m("Hand Management"), m("Modular Board", 2), m("Hexagon Grid", 2)],
    minWeight: 2.0,
  },
  {
    id: "builder",
    name: "The Architect",
    emoji: "🏗️",
    description: "You love constructing complex systems and watching your engine purr. Efficiency is your art form.",
    triggers: [g("Deck Building", 2), m("Engine Building", 3), m("Deck Building", 2), m("Tableau Building", 2), m("Network Building", 2), m("Tile Placement"), m("Pattern Building")],
    minWeight: 2.0,
  },
  {
    id: "collector",
    name: "The Curator",
    emoji: "🎲",
    description: "Breadth over depth — your shelf is eclectic, wide-ranging, and full of surprises.",
    triggers: [], // Fallback: many genres/families, low concentration
    minWeight: 0,
  },
  {
    id: "competitor",
    name: "The Gladiator",
    emoji: "🏆",
    description: "You live for the thrill of competition. Head-to-head, winner-takes-all — bring it on.",
    triggers: [g("Sports", 2), m("Player Elimination", 2), m("Take That", 2), m("Racing", 2), m("Betting and Bluffing"), m("Auction/Bidding", 2)],
    minWeight: 0,
  },
  {
    id: "thinker",
    name: "The Puzzle Master",
    emoji: "🧩",
    description: "Complex puzzles and optimization problems are your playground. You love the crunch.",
    triggers: [g("Abstract", 2), m("Puzzle", 3), m("Deduction", 2), m("Logic", 2), m("Pattern Recognition"), m("Set Collection"), m("Connections")],
    minWeight: 2.5,
  },
  {
    id: "diplomat",
    name: "The Diplomat",
    emoji: "🤝",
    description: "Cooperation over competition. You believe the best games are won together, not against each other.",
    triggers: [g("Cooperative", 3), m("Cooperative Game", 3), m("Solo / Cooperative Mode", 2), m("Team-Based Game", 2), m("Variable Player Powers"), m("Communication Limits")],
    minWeight: 0,
  },
  {
    id: "entertainer",
    name: "The Entertainer",
    emoji: "🎪",
    description: "You bring the fun! Party games, real-time chaos, and laugh-out-loud moments are your specialty.",
    triggers: [g("Party", 3), g("Humor", 2), g("Trivia", 2), m("Party Game", 3), m("Real-Time", 2), m("Dexterity", 2), m("Acting", 2)],
    minWeight: 0,
  },
  {
    id: "europurist",
    name: "The Euro Purist",
    emoji: "⚗️",
    description: "Low luck, tight economies, and elegant mechanisms. You appreciate the craft of game design at its finest.",
    triggers: [g("Strategy", 2), m("Action Drafting", 3), m("Market", 2), m("Income", 2), m("Variable Phase Order", 2), m("Rondel", 3), m("Action Points")],
    minWeight: 3.5,
  },
  {
    id: "cozygamer",
    name: "The Cozy Gamer",
    emoji: "☕",
    description: "You gravitate toward gentle, relaxing games with beautiful art and low-stress gameplay. Game night is about warmth, not war.",
    triggers: [g("Family", 2), g("Nature", 2), m("Pattern Building", 2), m("Tile Placement", 2), m("Set Collection", 2), m("Drafting"), m("Grid Coverage", 2), m("Layering")],
    minWeight: 0,
  },
  {
    id: "thrillseeker",
    name: "The Thrill Seeker",
    emoji: "🎃",
    description: "Suspense, hidden information, and the unknown keep you on the edge of your seat. You love the tension.",
    triggers: [g("Horror", 3), g("Mystery", 3), m("Deduction", 3), m("Hidden Roles", 2), m("Bluffing", 2), m("Traitor Game", 3), m("Memory")],
    minWeight: 0,
  },
  {
    id: "naturalist",
    name: "The Naturalist",
    emoji: "🌿",
    description: "Beautiful art, peaceful themes, and spatial puzzles draw you in. Your games are as pretty as they are clever.",
    triggers: [g("Nature", 3), g("Family"), m("Tile Placement", 3), m("Pattern Building", 2), m("Set Collection", 2), m("Grid Coverage", 2), m("Drafting")],
    minWeight: 0,
  },
  {
    id: "historian",
    name: "The Historian",
    emoji: "📚",
    description: "You're drawn to games rooted in real history and conflict. Every session is a lesson wrapped in strategy.",
    triggers: [g("Historical", 3), g("War", 3), g("Political", 2), m("Area Control", 2), m("Simulation", 2), m("Campaign", 2), m("Dice")],
    minWeight: 2.5,
  },
  {
    id: "worldbuilder",
    name: "The Worldbuilder",
    emoji: "🧙",
    description: "Epic worlds, evolving campaigns, and rich lore define your collection. You don't play games — you live them.",
    triggers: [g("Fantasy", 3), g("Sci-Fi", 3), m("Campaign", 3), m("Legacy", 3), m("Narrative", 2), m("Variable Player Powers", 2), m("Exploration")],
    minWeight: 0,
  },
] as const;

export type ArchetypeId = typeof ARCHETYPES[number]["id"];

export interface MechanicDNA {
  name: string;
  count: number;
  percentage: number;
}

export interface GenreDNA {
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
  genreDNA: GenreDNA[];
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
  genreDNA: GenreDNA[],
  avgWeight: number,
): { primary: typeof ARCHETYPES[number]; secondary: typeof ARCHETYPES[number] | null; confidence: number; scores: Map<string, number> } {
  const archetypeScores = ARCHETYPES.map(arch => {
    let score = 0;
    arch.triggers.forEach((trigger: TriggerDef) => {
      const tLower = trigger.signal.toLowerCase();
      if (trigger.type === "mechanic") {
        mechanicDNA.forEach(md => {
          if (md.name.toLowerCase() === tLower) {
            score += md.count * trigger.weight;
          }
        });
      } else {
        genreDNA.forEach(gd => {
          if (gd.name.toLowerCase() === tLower) {
            score += gd.count * trigger.weight;
          }
        });
      }
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
  const totalSignals = (mechanicDNA.reduce((s, md) => s + md.count, 0) + genreDNA.reduce((s, gd) => s + gd.count, 0)) || 1;
  const confidence = Math.min(100, Math.round((topScore / Math.max(totalSignals, 1)) * 100));

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

      // 2. Fetch mechanics (with family) for base games
      const gameIds = baseGames.map((g: any) => g.id);
      const BATCH = 50;
      const allMechanics: { game_id: string; mechanic: { id: string; name: string; family_id: string | null } | null }[] = [];

      for (let i = 0; i < gameIds.length; i += BATCH) {
        const batch = gameIds.slice(i, i + BATCH);
        const { data } = await supabase
          .from("game_mechanics")
          .select("game_id, mechanic:mechanics(id, name, family_id)")
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

      // 3b. Fetch genres for base games (via catalog_genres)
      const catalogIds = baseGames.map((g: any) => g.catalog_id).filter((c: any): c is string => !!c);
      const allGenres: { catalog_id: string; genre: string }[] = [];
      for (let i = 0; i < catalogIds.length; i += BATCH) {
        const batch = catalogIds.slice(i, i + BATCH);
        const { data } = await supabase
          .from("catalog_genres")
          .select("catalog_id, genre")
          .in("catalog_id", batch);
        if (data) allGenres.push(...(data as any));
      }

      // Build catalog_id -> game_id mapping for genre->game resolution
      const catalogToGameIds = new Map<string, string[]>();
      baseGames.forEach((g: any) => {
        if (g.catalog_id) {
          const arr = catalogToGameIds.get(g.catalog_id) || [];
          arr.push(g.id);
          catalogToGameIds.set(g.catalog_id, arr);
        }
      });

      // Resolve mechanic family names
      const uniqueFamilyIds = Array.from(new Set(
        allMechanics.map(gm => gm.mechanic?.family_id).filter(Boolean) as string[]
      ));
      const familyIdToName = new Map<string, string>();
      if (uniqueFamilyIds.length > 0) {
        for (let i = 0; i < uniqueFamilyIds.length; i += BATCH) {
          const batch = uniqueFamilyIds.slice(i, i + BATCH);
          const { data: familyMechanics } = await supabase
            .from("mechanics")
            .select("id, name")
            .in("id", batch);
          if (familyMechanics) {
            familyMechanics.forEach((fm: any) => familyIdToName.set(fm.id, fm.name));
          }
        }
      }

      // 4. Compute mechanic DNA — shelf-based, using FAMILY names
      const shelfFamilyCounts = new Map<string, number>();
      allMechanics.forEach(gm => {
        if (gm.mechanic) {
          const familyName = gm.mechanic.family_id
            ? (familyIdToName.get(gm.mechanic.family_id) || gm.mechanic.name)
            : gm.mechanic.name;
          shelfFamilyCounts.set(familyName, (shelfFamilyCounts.get(familyName) || 0) + 1);
        }
      });
      const shelfMechanicDNA = buildMechanicDNA(
        Array.from(shelfFamilyCounts.entries()).map(([name, count]) => ({ name, count })),
        baseGames.length
      );

      // 4b. Compute genre DNA — shelf-based
      const shelfGenreCounts = new Map<string, number>();
      allGenres.forEach(row => {
        const gids = catalogToGameIds.get(row.catalog_id) || [];
        gids.forEach(() => {
          shelfGenreCounts.set(row.genre, (shelfGenreCounts.get(row.genre) || 0) + 1);
        });
      });
      const shelfGenreDNA: GenreDNA[] = Array.from(shelfGenreCounts.entries())
        .map(([name, count]) => ({ name, count, percentage: Math.round((count / Math.max(baseGames.length, 1)) * 100) }))
        .sort((a, b) => b.count - a.count);

      // 4c. Compute genre DNA — blended (play-weighted)
      const blendedGenreCounts = new Map<string, number>();
      const playOnlyGenreCounts = new Map<string, number>();
      allGenres.forEach(row => {
        const gids = catalogToGameIds.get(row.catalog_id) || [];
        gids.forEach(gid => {
          const sessions = sessionCounts.get(gid) || 0;
          const playMultiplier = sessions > 0 ? 1 + Math.log2(sessions + 1) : 0.5;
          blendedGenreCounts.set(row.genre, (blendedGenreCounts.get(row.genre) || 0) + playMultiplier);
          if (sessions > 0) {
            playOnlyGenreCounts.set(row.genre, (playOnlyGenreCounts.get(row.genre) || 0) + sessions);
          }
        });
      });
      const blendedGenreDNA: GenreDNA[] = Array.from(blendedGenreCounts.entries())
        .map(([name, count]) => ({ name, count: Math.round(count), percentage: Math.round((Math.round(count) / Math.max(baseGames.length, 1)) * 100) }))
        .sort((a, b) => b.count - a.count);
      const playOnlyGenreDNA: GenreDNA[] = Array.from(playOnlyGenreCounts.entries())
        .map(([name, count]) => ({ name, count, percentage: Math.round((count / Math.max(sessionCounts.size, 1)) * 100) }))
        .sort((a, b) => b.count - a.count);

      const genreDNA = blendedGenreDNA.slice(0, 12);

      // 5. Compute play-weighted mechanic DNA (family-based)
      const playFamilyCounts = new Map<string, number>();
      const playOnlyFamilyCounts = new Map<string, number>();
      allMechanics.forEach(gm => {
        if (gm.mechanic) {
          const familyName = gm.mechanic.family_id
            ? (familyIdToName.get(gm.mechanic.family_id) || gm.mechanic.name)
            : gm.mechanic.name;
          const sessions = sessionCounts.get(gm.game_id) || 0;
          const playMultiplier = sessions > 0 ? 1 + Math.log2(sessions + 1) : 0.5;
          playFamilyCounts.set(familyName, (playFamilyCounts.get(familyName) || 0) + playMultiplier);
          if (sessions > 0) {
            playOnlyFamilyCounts.set(familyName, (playOnlyFamilyCounts.get(familyName) || 0) + sessions);
          }
        }
      });

      const blendedMechanicDNA = buildMechanicDNA(
        Array.from(playFamilyCounts.entries()).map(([name, count]) => ({ name, count: Math.round(count) })),
        baseGames.length
      );

      const playOnlyDNA = buildMechanicDNA(
        Array.from(playOnlyFamilyCounts.entries()).map(([name, count]) => ({ name, count })),
        sessionCounts.size || 1
      );

      // 6. Weight calculations
      const weights = baseGames.map((g: any) => g.catalog?.weight).filter((w: any): w is number => w != null && w > 0);
      const avgWeight = weights.length > 0 ? weights.reduce((s: number, w: number) => s + w, 0) / weights.length : 0;

      // 7. Score all three perspectives
      const shelfResult = scoreArchetypes(shelfMechanicDNA, shelfGenreDNA, avgWeight);
      const blendedResult = scoreArchetypes(blendedMechanicDNA, blendedGenreDNA, avgWeight);
      const playResult = hasPlayData ? scoreArchetypes(playOnlyDNA, playOnlyGenreDNA, avgWeight) : null;

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

      // 15. Rarity score (catalogIds already computed above)
      let rarity: CollectionRarity | null = null;

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
        genreDNA,
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
