import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { startOfMonth, endOfMonth, format, differenceInMinutes, parseISO } from "date-fns";

export interface PlayStats {
  totalPlays: number;
  gamesPlayed: number;
  newGamesThisMonth: number;
  uniquePlayers: number;
  totalHours: number;
  daysWithPlays: number;
  hIndex: number;
  topMechanics: { name: string; percentage: number; count: number }[];
  topGames: { id: string; title: string; image_url: string | null; plays: number }[];
  monthLabel: string;
}

interface GamePlayCount {
  gameId: string;
  count: number;
}

function calculateHIndex(playCounts: number[]): number {
  // Sort in descending order
  const sorted = [...playCounts].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) {
      h = i + 1;
    } else {
      break;
    }
  }
  return h;
}

export function usePlayStats(libraryId: string | null, month?: Date) {
  const targetMonth = month || new Date();
  const monthStart = startOfMonth(targetMonth);
  const monthEnd = endOfMonth(targetMonth);

  return useQuery({
    queryKey: ["play-stats", libraryId, format(monthStart, "yyyy-MM")],
    queryFn: async (): Promise<PlayStats> => {
      if (!libraryId) throw new Error("No library ID");

      // Get all games for this library
      const { data: games } = await supabase
        .from("games")
        .select("id, title, image_url, created_at")
        .eq("library_id", libraryId)
        .eq("is_expansion", false);

      if (!games || games.length === 0) {
        return {
          totalPlays: 0,
          gamesPlayed: 0,
          newGamesThisMonth: 0,
          uniquePlayers: 0,
          totalHours: 0,
          daysWithPlays: 0,
          hIndex: 0,
          topMechanics: [],
          topGames: [],
          monthLabel: format(targetMonth, "MMM yyyy"),
        };
      }

      const gameIds = games.map((g) => g.id);
      const gameMap = new Map(games.map((g) => [g.id, g]));

      // Get all sessions for this month
      const { data: sessions } = await supabase
        .from("game_sessions")
        .select("id, game_id, played_at, duration_minutes")
        .in("game_id", gameIds)
        .gte("played_at", monthStart.toISOString())
        .lte("played_at", monthEnd.toISOString());

      const sessionList = sessions || [];
      const totalPlays = sessionList.length;

      // Unique games played this month
      const uniqueGameIds = new Set(sessionList.map((s) => s.game_id));
      const gamesPlayed = uniqueGameIds.size;

      // Calculate plays per game for H-index and top games
      const playCountMap = new Map<string, number>();
      sessionList.forEach((s) => {
        playCountMap.set(s.game_id, (playCountMap.get(s.game_id) || 0) + 1);
      });

      const playCounts = Array.from(playCountMap.values());
      const hIndex = calculateHIndex(playCounts);

      // Top games by play count
      const topGames = Array.from(playCountMap.entries())
        .map(([gameId, plays]) => {
          const game = gameMap.get(gameId);
          return {
            id: gameId,
            title: game?.title || "Unknown",
            image_url: game?.image_url || null,
            plays,
          };
        })
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 10);

      // Total hours from duration_minutes
      const totalMinutes = sessionList.reduce(
        (sum, s) => sum + (s.duration_minutes || 0),
        0
      );
      const totalHours = Math.round(totalMinutes / 60);

      // Days with plays
      const playDates = new Set(
        sessionList.map((s) => format(parseISO(s.played_at), "yyyy-MM-dd"))
      );
      const daysWithPlays = playDates.size;

      // Get unique players from session players
      const sessionIds = sessionList.map((s) => s.id);
      let uniquePlayers = 0;
      if (sessionIds.length > 0) {
        const { data: players } = await supabase
          .from("game_session_players")
          .select("player_name")
          .in("session_id", sessionIds);

        const uniquePlayerNames = new Set(
          (players || []).map((p) => p.player_name.toLowerCase().trim())
        );
        uniquePlayers = uniquePlayerNames.size;
      }

      // New games this month (games with first play this month)
      // Get all sessions for these games to find first play dates
      const { data: allSessions } = await supabase
        .from("game_sessions")
        .select("game_id, played_at")
        .in("game_id", Array.from(uniqueGameIds))
        .order("played_at", { ascending: true });

      const firstPlayDates = new Map<string, Date>();
      (allSessions || []).forEach((s) => {
        if (!firstPlayDates.has(s.game_id)) {
          firstPlayDates.set(s.game_id, parseISO(s.played_at));
        }
      });

      let newGamesThisMonth = 0;
      firstPlayDates.forEach((date) => {
        if (date >= monthStart && date <= monthEnd) {
          newGamesThisMonth++;
        }
      });

      // Get mechanics for played games
      const playedGameIds = Array.from(uniqueGameIds);
      let topMechanics: { name: string; percentage: number; count: number }[] = [];
      
      if (playedGameIds.length > 0) {
        const { data: gameMechanics } = await supabase
          .from("game_mechanics")
          .select("game_id, mechanic_id")
          .in("game_id", playedGameIds);

        if (gameMechanics && gameMechanics.length > 0) {
          const mechanicIds = [...new Set(gameMechanics.map((gm) => gm.mechanic_id))];
          
          const { data: mechanics } = await supabase
            .from("mechanics")
            .select("id, name")
            .in("id", mechanicIds);

          const mechanicNameMap = new Map(
            (mechanics || []).map((m) => [m.id, m.name])
          );

          // Count how many played games have each mechanic
          const mechanicCounts = new Map<string, number>();
          gameMechanics.forEach((gm) => {
            const name = mechanicNameMap.get(gm.mechanic_id);
            if (name) {
              mechanicCounts.set(name, (mechanicCounts.get(name) || 0) + 1);
            }
          });

          topMechanics = Array.from(mechanicCounts.entries())
            .map(([name, count]) => ({
              name,
              count,
              percentage: Math.round((count / playedGameIds.length) * 100),
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
        }
      }

      return {
        totalPlays,
        gamesPlayed,
        newGamesThisMonth,
        uniquePlayers,
        totalHours,
        daysWithPlays,
        hIndex,
        topMechanics,
        topGames,
        monthLabel: format(targetMonth, "MMM yyyy"),
      };
    },
    enabled: !!libraryId,
  });
}
