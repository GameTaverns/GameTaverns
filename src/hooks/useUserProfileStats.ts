import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface UserProfileStats {
  globalElo: number | null;
  peakElo: number | null;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  overallWinRate: number;
  eloByGame: { gameTitle: string; elo: number; gamesPlayed: number; wins: number; losses: number }[];
  playedWith: { name: string; sessions: number }[];
  topCategories: { category: string; count: number }[];
}

export function useUserProfileStats(userId: string | null) {
  return useQuery({
    queryKey: ["user-profile-stats", userId],
    queryFn: async (): Promise<UserProfileStats> => {
      if (!userId) throw new Error("No user ID");

      // ELO ratings
      const { data: eloData, error: eloErr } = await (supabase as any)
        .from("player_elo_ratings")
        .select("game_id, elo, games_played, wins, losses, peak_elo, games(title)")
        .eq("user_id", userId)
        .order("elo", { ascending: false });

      if (eloErr) throw eloErr;

      const globalEntry = (eloData || []).find((e: any) => e.game_id === null);
      const gameEntries = (eloData || []).filter((e: any) => e.game_id !== null);

      const eloByGame = gameEntries
        .filter((e: any) => e.games_played >= 1)
        .map((e: any) => ({
          gameTitle: e.games?.title || "Unknown",
          elo: e.elo,
          gamesPlayed: e.games_played,
          wins: e.wins,
          losses: e.losses,
        }))
        .sort((a: any, b: any) => b.elo - a.elo)
        .slice(0, 15);

      // Session players — who does this user play with?
      const { data: linkedSessions, error: lsErr } = await (supabase as any)
        .from("game_session_players")
        .select("session_id")
        .eq("linked_user_id", userId)
        .eq("tag_status", "accepted")
        .limit(500);

      if (lsErr) throw lsErr;

      const sessionIds = (linkedSessions || []).map((s: any) => s.session_id);
      const playedWith: UserProfileStats["playedWith"] = [];

      if (sessionIds.length > 0) {
        const BATCH = 200;
        const coPlayers = new Map<string, number>();
        for (let i = 0; i < sessionIds.length; i += BATCH) {
          const batch = sessionIds.slice(i, i + BATCH);
          const { data: otherPlayers } = await supabase
            .from("game_session_players")
            .select("player_name, linked_user_id")
            .in("session_id", batch);

          otherPlayers?.forEach((p: any) => {
            // Exclude self
            if (p.linked_user_id === userId) return;
            const name = p.player_name.trim();
            coPlayers.set(name, (coPlayers.get(name) || 0) + 1);
          });
        }

        Array.from(coPlayers.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([name, sessions]) => playedWith.push({ name, sessions }));
      }

      // Game type preferences from sessions
      const { data: sessionGames, error: sgErr } = await (supabase as any)
        .from("game_session_players")
        .select("game_sessions(game_id, games(game_type))")
        .eq("linked_user_id", userId)
        .eq("tag_status", "accepted")
        .limit(500);

      const catCounts = new Map<string, number>();
      (sessionGames || []).forEach((sp: any) => {
        const gt = sp.game_sessions?.games?.game_type;
        if (gt) catCounts.set(gt, (catCounts.get(gt) || 0) + 1);
      });

      const topCategories = Array.from(catCounts.entries())
        .map(([category, count]) => ({ category: category.replace(/_/g, " "), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const totalGamesPlayed = globalEntry?.games_played || gameEntries.reduce((s: number, e: any) => s + e.games_played, 0);
      const totalWins = globalEntry?.wins || gameEntries.reduce((s: number, e: any) => s + e.wins, 0);
      const totalLosses = globalEntry?.losses || gameEntries.reduce((s: number, e: any) => s + e.losses, 0);

      return {
        globalElo: globalEntry?.elo || null,
        peakElo: globalEntry?.peak_elo || null,
        totalGamesPlayed,
        totalWins,
        totalLosses,
        overallWinRate: totalGamesPlayed > 0 ? Math.round((totalWins / totalGamesPlayed) * 100) : 0,
        eloByGame,
        playedWith,
        topCategories,
      };
    },
    enabled: !!userId,
  });
}
