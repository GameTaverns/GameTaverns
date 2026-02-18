import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface EloRating {
  user_id: string;
  game_id: string | null;
  elo: number;
  games_played: number;
  wins: number;
  losses: number;
  peak_elo: number;
  updated_at: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

export function useGameLeaderboard(gameId: string | null, limit = 10) {
  return useQuery({
    queryKey: ["elo-leaderboard", gameId, limit],
    queryFn: async (): Promise<EloRating[]> => {
      if (!gameId) return [];
      const { data, error } = await (supabase as any)
        .from("player_elo_ratings")
        .select(
          `
          user_id, game_id, elo, games_played, wins, losses, peak_elo, updated_at,
          user_profiles!inner(display_name, username, avatar_url)
        `
        )
        .eq("game_id", gameId)
        .gte("games_played", 1)
        .order("elo", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data || []) as any[]).map((r: any) => ({
        ...r,
        display_name: r.user_profiles?.display_name,
        username: r.user_profiles?.username,
        avatar_url: r.user_profiles?.avatar_url,
      }));
    },
    enabled: !!gameId,
  });
}

export function useGlobalLeaderboard(limit = 20) {
  return useQuery({
    queryKey: ["elo-global-leaderboard", limit],
    queryFn: async (): Promise<EloRating[]> => {
      const { data, error } = await (supabase as any)
        .from("player_elo_ratings")
        .select(
          `
          user_id, game_id, elo, games_played, wins, losses, peak_elo, updated_at,
          user_profiles!inner(display_name, username, avatar_url)
        `
        )
        .is("game_id", null)
        .gte("games_played", 3)
        .order("elo", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data || []) as any[]).map((r: any) => ({
        ...r,
        display_name: r.user_profiles?.display_name,
        username: r.user_profiles?.username,
        avatar_url: r.user_profiles?.avatar_url,
      }));
    },
  });
}

export function useUserElo(userId: string | null, gameId?: string | null) {
  return useQuery({
    queryKey: ["user-elo", userId, gameId],
    queryFn: async (): Promise<EloRating | null> => {
      if (!userId) return null;
      let q = (supabase as any)
        .from("player_elo_ratings")
        .select("*")
        .eq("user_id", userId);
      if (gameId !== undefined) {
        q = gameId ? q.eq("game_id", gameId) : q.is("game_id", null);
      }
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useSessionTagRequests() {
  return useQuery({
    queryKey: ["session-tag-requests"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data, error } = await (supabase as any)
        .from("session_tag_requests")
        .select("*")
        .eq("tagged_user_id", session.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}
