import { useQuery } from "@tanstack/react-query";
import { supabase, isSelfHostedMode, apiClient } from "@/integrations/backend/client";
import { useTenant } from "@/contexts/TenantContext";
import { getSupabaseConfig } from "@/config/runtime";

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

export interface GameRecommendationsResult {
  discoveries: GameRecommendation[];
  collection_matches: GameRecommendation[];
}

export function useGameRecommendations(gameId: string | undefined, enabled = true) {
  const { library } = useTenant();

  return useQuery({
    queryKey: ["game-recommendations", gameId, library?.id],
    queryFn: async (): Promise<GameRecommendationsResult> => {
      if (!gameId || !library?.id) return { discoveries: [], collection_matches: [] };

      const payload = { game_id: gameId, library_id: library.id, limit: 10 };

      if (isSelfHostedMode()) {
        try {
          const response = await apiClient.post<any>("/games/recommendations", payload);
          return {
            discoveries: response.discoveries || [],
            collection_matches: response.collection_matches || [],
          };
        } catch {
          return { discoveries: [], collection_matches: [] };
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { url: apiUrl, anonKey } = getSupabaseConfig();

      const response = await fetch(
        `${apiUrl}/functions/v1/game-recommendations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get recommendations");
      }

      const data = await response.json();
      return {
        discoveries: data.discoveries || [],
        collection_matches: data.collection_matches || [],
      };
    },
    enabled: enabled && !!gameId && !!library?.id,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
}
