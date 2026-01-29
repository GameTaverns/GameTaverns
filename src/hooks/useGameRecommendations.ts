import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export interface GameRecommendation {
  id: string;
  title: string;
  slug: string | null;
  image_url: string | null;
  difficulty: string | null;
  play_time: string | null;
  min_players: number | null;
  max_players: number | null;
  reason: string;
}

export function useGameRecommendations(gameId: string | undefined, enabled = true) {
  const { library } = useTenant();

  return useQuery({
    queryKey: ["game-recommendations", gameId, library?.id],
    queryFn: async (): Promise<GameRecommendation[]> => {
      if (!gameId || !library?.id) return [];

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-recommendations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            game_id: gameId,
            library_id: library.id,
            limit: 5,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get recommendations");
      }

      const data = await response.json();
      return data.recommendations || [];
    },
    enabled: enabled && !!gameId && !!library?.id,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    retry: 1,
  });
}
