import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_points: number;
  achievements_earned: number;
  quest_bonus: number;
  grand_total: number;
}

export function useLeaderboard(limit = 50) {
  return useQuery({
    queryKey: ["achievement-leaderboard", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("achievement_leaderboard")
        .select("*")
        .limit(limit);

      if (error) throw error;
      return (data || []) as LeaderboardEntry[];
    },
    staleTime: 60_000, // Cache for 1 minute
  });
}
