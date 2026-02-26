import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface CollectionBreakdown {
  byPlayerCount: { label: string; count: number }[];
  byDifficulty: { label: string; count: number }[];
  byGameType: { label: string; count: number }[];
  shelfOfShame: { id: string; title: string; image_url: string | null; addedDaysAgo: number }[];
  collectionGrowth: { date: string; total: number }[];
  totalOwned: number;
  totalExpansions: number;
  totalPreviouslyOwned: number;
  percentUnplayed: number;
}

export function useCollectionBreakdown(libraryId: string | null) {
  return useQuery({
    queryKey: ["collection-breakdown", libraryId],
    queryFn: async (): Promise<CollectionBreakdown> => {
      if (!libraryId) throw new Error("No library ID");

      const { data: games, error } = await supabase
        .from("games")
        .select("id, title, image_url, min_players, max_players, difficulty, game_type, is_expansion, is_unplayed, ownership_status, created_at")
        .eq("library_id", libraryId);

      if (error) throw error;
      if (!games || games.length === 0) {
        return {
          byPlayerCount: [], byDifficulty: [], byGameType: [],
          shelfOfShame: [], collectionGrowth: [],
          totalOwned: 0, totalExpansions: 0, totalPreviouslyOwned: 0, percentUnplayed: 0,
        };
      }

      const owned = games.filter((g) => g.ownership_status === "owned" && !g.is_expansion);
      const expansions = games.filter((g) => g.is_expansion);
      const prevOwned = games.filter((g) => g.ownership_status === "previously_owned");

      // Player count breakdown
      const playerBuckets: Record<string, number> = { "1": 0, "2": 0, "3-4": 0, "5-6": 0, "7+": 0 };
      owned.forEach((g) => {
        const min = g.min_players || 1;
        const max = g.max_players || min;
        if (min === 1 && max === 1) playerBuckets["1"]++;
        else if (max <= 2) playerBuckets["2"]++;
        else if (max <= 4) playerBuckets["3-4"]++;
        else if (max <= 6) playerBuckets["5-6"]++;
        else playerBuckets["7+"]++;
      });

      // Difficulty breakdown
      const diffCounts = new Map<string, number>();
      owned.forEach((g) => {
        const d = g.difficulty || "Unknown";
        diffCounts.set(d, (diffCounts.get(d) || 0) + 1);
      });

      // Game type breakdown
      const typeCounts = new Map<string, number>();
      owned.forEach((g) => {
        const t = g.game_type || "Unknown";
        typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
      });

      // Shelf of shame (owned + unplayed, oldest first)
      const unplayed = owned
        .filter((g) => g.is_unplayed)
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        .slice(0, 10)
        .map((g) => ({
          id: g.id,
          title: g.title,
          image_url: g.image_url,
          addedDaysAgo: Math.floor((Date.now() - new Date(g.created_at || 0).getTime()) / 86400000),
        }));

      // Collection growth (cumulative by month)
      const byMonth = new Map<string, number>();
      const sorted = [...games].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      let cumulative = 0;
      sorted.forEach((g) => {
        if (g.ownership_status === "owned") {
          cumulative++;
          const month = (g.created_at || "").slice(0, 7); // yyyy-MM
          if (month) byMonth.set(month, cumulative);
        }
      });

      const percentUnplayed = owned.length > 0
        ? Math.round((unplayed.length / owned.filter((g) => g.is_unplayed).length) * 100 / owned.length * owned.filter((g) => g.is_unplayed).length)
        : 0;

      // Simpler percent calc
      const unplayedCount = owned.filter((g) => g.is_unplayed).length;
      const pctUnplayed = owned.length > 0 ? Math.round((unplayedCount / owned.length) * 100) : 0;

      return {
        byPlayerCount: Object.entries(playerBuckets).map(([label, count]) => ({ label, count })),
        byDifficulty: Array.from(diffCounts.entries())
          .map(([label, count]) => ({ label: label.replace(/_/g, " "), count }))
          .sort((a, b) => b.count - a.count),
        byGameType: Array.from(typeCounts.entries())
          .map(([label, count]) => ({ label: label.replace(/_/g, " "), count }))
          .sort((a, b) => b.count - a.count),
        shelfOfShame: unplayed,
        collectionGrowth: Array.from(byMonth.entries()).map(([date, total]) => ({ date, total })),
        totalOwned: owned.length,
        totalExpansions: expansions.length,
        totalPreviouslyOwned: prevOwned.length,
        percentUnplayed: pctUnplayed,
      };
    },
    enabled: !!libraryId,
  });
}
