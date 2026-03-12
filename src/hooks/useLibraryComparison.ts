import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface ComparisonGame {
  title: string;
  image_url: string | null;
  slug: string | null;
}

export interface SharedGame extends ComparisonGame {
  a_plays: number;
  b_plays: number;
  min_players: number | null;
  max_players: number | null;
  play_time_minutes: number | null;
  weight: number | null;
}

export interface PlayTogetherGame extends ComparisonGame {
  combined_plays: number;
  min_players: number | null;
  max_players: number | null;
  play_time_minutes: number | null;
  weight: number | null;
}

export interface ComparisonStats {
  total: number;
  avg_weight: number | null;
  avg_playtime: number | null;
  total_plays: number;
}

export interface LibraryComparisonResult {
  shared_games: SharedGame[];
  shared_count: number;
  unique_a: ComparisonGame[];
  unique_a_count: number;
  unique_b: ComparisonGame[];
  unique_b_count: number;
  stats_a: ComparisonStats;
  stats_b: ComparisonStats;
  play_together: PlayTogetherGame[];
  compatibility_score: number;
}

export function useLibraryComparison(
  currentUserId: string | undefined,
  targetUserId: string | undefined
) {
  return useQuery({
    queryKey: ["library-comparison", currentUserId, targetUserId],
    queryFn: async (): Promise<LibraryComparisonResult | null> => {
      if (!currentUserId || !targetUserId) return null;

      const { data, error } = await (supabase as any).rpc("compare_libraries", {
        user_a: currentUserId,
        user_b: targetUserId,
      });

      if (error) throw error;
      return data as LibraryComparisonResult;
    },
    enabled: !!currentUserId && !!targetUserId && currentUserId !== targetUserId,
    staleTime: 5 * 60 * 1000,
  });
}
