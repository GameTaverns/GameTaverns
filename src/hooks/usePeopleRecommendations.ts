import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export interface RecommendedUser {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  games_owned: number;
  sessions_logged: number;
  primary_archetype: string | null;
  shared_mechanics: number;
  shared_games: number;
  top_shared_games: string[];
  similarity_score: number;
}

export function usePeopleRecommendations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["people-recommendations", user?.id],
    queryFn: async (): Promise<RecommendedUser[]> => {
      if (!user) return [];

      const { data, error } = await (supabase as any).rpc("discover_similar_users", {
        _user_id: user.id,
        _limit: 12,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
