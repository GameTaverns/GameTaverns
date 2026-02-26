import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface UserProfileStats {
  globalElo: number | null;
  peakElo: number | null;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  overallWinRate: number;
  totalSessions: number;
  uniqueGamesPlayed: number;
  avgSessionsPerMonth: number;
  currentStreak: number;
  longestStreak: number;
  eloByGame: { gameTitle: string; elo: number; gamesPlayed: number; wins: number; losses: number }[];
  playedWith: { name: string; sessions: number }[];
  topCategories: { category: string; count: number }[];
  dayOfWeekDistribution: { day: string; count: number }[];
  monthlyPlayTrend: { month: string; count: number }[];
  recentGames: { title: string; playedAt: string; result: string | null }[];
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

      if (eloErr) {
        console.warn("[useUserProfileStats] ELO query failed, falling back to empty stats", eloErr);
      }

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

      // All sessions where user participated
      const { data: linkedSessions, error: lsErr } = await (supabase as any)
        .from("game_session_players")
        .select("session_id, is_winner, game_sessions(played_at, game_id, games(title, game_type))")
        .eq("linked_user_id", userId)
        .eq("tag_status", "accepted")
        .limit(1000);

      if (lsErr) {
        console.warn("[useUserProfileStats] Session query failed, falling back to empty sessions", lsErr);
      }

      const sessions = linkedSessions || [];
      const totalSessions = sessions.length;

      // Unique games played
      const uniqueGameIds = new Set<string>();
      sessions.forEach((s: any) => {
        if (s.game_sessions?.game_id) uniqueGameIds.add(s.game_sessions.game_id);
      });
      const uniqueGamesPlayed = uniqueGameIds.size;

      // Day of week distribution
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayCounts = new Array(7).fill(0);
      const playDates = new Set<string>();
      const monthCounts = new Map<string, number>();

      sessions.forEach((s: any) => {
        const playedAt = s.game_sessions?.played_at;
        if (playedAt) {
          const d = new Date(playedAt);
          dayCounts[d.getDay()]++;
          const dateStr = playedAt.slice(0, 10);
          playDates.add(dateStr);
          const month = playedAt.slice(0, 7);
          monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
        }
      });

      const dayOfWeekDistribution = dayNames.map((day, i) => ({ day, count: dayCounts[i] }));

      const monthlyPlayTrend = Array.from(monthCounts.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      // Avg sessions per month
      const avgSessionsPerMonth = monthlyPlayTrend.length > 0
        ? Math.round(totalSessions / monthlyPlayTrend.length)
        : 0;

      // Play streaks (consecutive days)
      const sortedDates = Array.from(playDates).sort();
      let currentStreak = 0;
      let longestStreak = 0;
      let streak = 0;

      for (let i = 0; i < sortedDates.length; i++) {
        if (i === 0) {
          streak = 1;
        } else {
          const prev = new Date(sortedDates[i - 1]);
          const curr = new Date(sortedDates[i]);
          const diff = (curr.getTime() - prev.getTime()) / 86400000;
          streak = diff === 1 ? streak + 1 : 1;
        }
        longestStreak = Math.max(longestStreak, streak);
      }

      // Check if current streak is active (last play within 1 day)
      if (sortedDates.length > 0) {
        const lastPlay = new Date(sortedDates[sortedDates.length - 1]);
        const daysSinceLast = (Date.now() - lastPlay.getTime()) / 86400000;
        currentStreak = daysSinceLast <= 1.5 ? streak : 0;
      }

      // Co-players
      const sessionIds = sessions.map((s: any) => s.session_id);
      const playedWith: UserProfileStats["playedWith"] = [];

      if (sessionIds.length > 0) {
        const coPlayers = new Map<string, number>();
        for (let i = 0; i < sessionIds.length; i += 200) {
          const batch = sessionIds.slice(i, i + 200);
          const { data: otherPlayers, error: otherPlayersError } = await supabase
            .from("game_session_players")
            .select("player_name, linked_user_id")
            .in("session_id", batch);

          if (otherPlayersError) {
            console.warn("[useUserProfileStats] Co-player query batch failed", otherPlayersError);
            continue;
          }

          otherPlayers?.forEach((p: any) => {
            if (p.linked_user_id === userId) return;
            const name = typeof p.player_name === "string" ? p.player_name.trim() : "";
            if (!name) return;
            coPlayers.set(name, (coPlayers.get(name) || 0) + 1);
          });
        }

        Array.from(coPlayers.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([name, s]) => playedWith.push({ name, sessions: s }));
      }

      // Game type preferences
      const catCounts = new Map<string, number>();
      sessions.forEach((s: any) => {
        const gt = s.game_sessions?.games?.game_type;
        if (gt) catCounts.set(gt, (catCounts.get(gt) || 0) + 1);
      });

      const topCategories = Array.from(catCounts.entries())
        .map(([category, count]) => ({ category: category.replace(/_/g, " "), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Recent games
      const recentGames = sessions
        .filter((s: any) => s.game_sessions?.played_at)
        .sort((a: any, b: any) => new Date(b.game_sessions.played_at).getTime() - new Date(a.game_sessions.played_at).getTime())
        .slice(0, 5)
        .map((s: any) => ({
          title: s.game_sessions?.games?.title || "Unknown",
          playedAt: s.game_sessions.played_at,
          result: s.is_winner === true ? "Won" : s.is_winner === false ? "Lost" : null,
        }));

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
        totalSessions,
        uniqueGamesPlayed,
        avgSessionsPerMonth,
        currentStreak,
        longestStreak,
        eloByGame,
        playedWith,
        topCategories,
        dayOfWeekDistribution,
        monthlyPlayTrend,
        recentGames,
      };
    },
    enabled: !!userId,
  });
}
