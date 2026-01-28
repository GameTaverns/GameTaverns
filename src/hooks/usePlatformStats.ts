import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PlatformStats {
  librariesCount: number;
  gamesCount: number;
  playsCount: number;
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: async (): Promise<PlatformStats> => {
      // Fetch counts in parallel
      const [librariesResult, gamesResult, sessionsResult] = await Promise.all([
        supabase
          .from("libraries_public")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("games_public")
          .select("*", { count: "exact", head: true })
          .eq("is_expansion", false),
        supabase
          .from("game_sessions")
          .select("*", { count: "exact", head: true }),
      ]);

      return {
        librariesCount: librariesResult.count || 0,
        gamesCount: gamesResult.count || 0,
        playsCount: sessionsResult.count || 0,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Format number with + suffix for display
export function formatStatNumber(num: number): string {
  if (num >= 1000) {
    const k = num / 1000;
    return k >= 10 ? `${Math.floor(k)}k+` : `${k.toFixed(1)}k+`;
  }
  return `${num}+`;
}
