import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  parseISO,
} from "date-fns";
import type { PlayStats, StatsPeriod } from "@/hooks/playStats/types";
import { calculateHIndex } from "@/hooks/playStats/calculateHIndex";
import { fetchLibrarySessionsForPeriod } from "@/hooks/playStats/fetchLibrarySessions";

export type { PlayStats, StatsPeriod };

// NOTE: helper logic extracted to src/hooks/playStats/* to keep this hook maintainable.

export function usePlayStats(
  libraryId: string | null, 
  targetDate?: Date,
  period: StatsPeriod = "month"
) {
  const target = targetDate || new Date();
  const periodStart = period === "month" ? startOfMonth(target) : startOfYear(target);
  const periodEnd = period === "month" ? endOfMonth(target) : endOfYear(target);
  const periodKey = period === "month" 
    ? format(periodStart, "yyyy-MM") 
    : format(periodStart, "yyyy");

  return useQuery({
    queryKey: ["play-stats", libraryId, periodKey, period],
    queryFn: async (): Promise<PlayStats> => {
      if (!libraryId) throw new Error("No library ID");

      // Get all games for this library
      const { data: games, error: gamesError } = await supabase
        .from("games")
        .select("id, title, image_url, created_at")
        .eq("library_id", libraryId)
        .eq("is_expansion", false);

      if (gamesError) throw gamesError;

      const periodLabel = period === "month" 
        ? format(target, "MMM yyyy") 
        : format(target, "yyyy");

      if (!games || games.length === 0) {
        return {
          totalPlays: 0,
          gamesPlayed: 0,
          newGamesThisPeriod: 0,
          uniquePlayers: 0,
          totalHours: 0,
          daysWithPlays: 0,
          hIndex: 0,
          topMechanics: [],
          topGames: [],
          periodLabel,
        };
      }

      const gameIds = games.map((g) => g.id);
      const gameMap = new Map(games.map((g) => [g.id, g]));

      // Get all sessions for this period
      // IMPORTANT: query by library via join filter to avoid massive `in(game_id, ...)` URLs.
      const sessionList = await fetchLibrarySessionsForPeriod({
        libraryId,
        periodStartIso: periodStart.toISOString(),
        periodEndIso: periodEnd.toISOString(),
      });

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

      // Get unique players from session players (batched to avoid URL overflow)
      const sessionIds = sessionList.map((s) => s.id);
      let uniquePlayers = 0;
      if (sessionIds.length > 0) {
        const BATCH = 200;
        const allPlayerNames: string[] = [];
        for (let i = 0; i < sessionIds.length; i += BATCH) {
          const batch = sessionIds.slice(i, i + BATCH);
          const { data: players, error: playersError } = await supabase
            .from("game_session_players")
            .select("player_name")
            .in("session_id", batch);
          if (playersError) throw playersError;
          if (players) allPlayerNames.push(...players.map((p) => p.player_name.toLowerCase().trim()));
        }

        const uniquePlayerNames = new Set(allPlayerNames);
        uniquePlayers = uniquePlayerNames.size;
      }

      // New games this month (games with first play this month)
      // Get all sessions for these games to find first play dates (batched)
      const uniqueGameArray = Array.from(uniqueGameIds);
      const BATCH_IDS = 50;
      const allFirstPlaySessions: any[] = [];
      for (let i = 0; i < uniqueGameArray.length; i += BATCH_IDS) {
        const batch = uniqueGameArray.slice(i, i + BATCH_IDS);
        const { data, error: batchErr } = await supabase
          .from("game_sessions")
          .select("game_id, played_at")
          .in("game_id", batch)
          .order("played_at", { ascending: true });
        if (batchErr) throw batchErr;
        if (data) allFirstPlaySessions.push(...data);
      }

      const firstPlayDates = new Map<string, Date>();
      allFirstPlaySessions.forEach((s) => {
        if (!firstPlayDates.has(s.game_id)) {
          firstPlayDates.set(s.game_id, parseISO(s.played_at));
        }
      });

      let newGamesThisPeriod = 0;
      firstPlayDates.forEach((date) => {
        if (date >= periodStart && date <= periodEnd) {
          newGamesThisPeriod++;
        }
      });

      // Get mechanics for played games
      const playedGameIds = Array.from(uniqueGameIds);
      let topMechanics: { name: string; percentage: number; count: number }[] = [];
      
      if (playedGameIds.length > 0) {
        // Batch queries to avoid URL length overflow
        const BATCH_SIZE = 50;
        const allGameMechanics: any[] = [];
        for (let i = 0; i < playedGameIds.length; i += BATCH_SIZE) {
          const batch = playedGameIds.slice(i, i + BATCH_SIZE);
          const { data, error } = await supabase
            .from("game_mechanics")
            .select("game_id, mechanic_id")
            .in("game_id", batch);
          if (error) throw error;
          if (data) allGameMechanics.push(...data);
        }
        const gameMechanics = allGameMechanics;

        if (gameMechanics && gameMechanics.length > 0) {
          const mechanicIds = [...new Set(gameMechanics.map((gm) => gm.mechanic_id))];
          
          const allMechanics: any[] = [];
          for (let i = 0; i < mechanicIds.length; i += BATCH_SIZE) {
            const batch = mechanicIds.slice(i, i + BATCH_SIZE);
            const { data, error } = await supabase.from("mechanics").select("id, name").in("id", batch);
            if (error) throw error;
            if (data) allMechanics.push(...data);
          }
          const mechanics = allMechanics;

          // Errors already thrown inside batch loop above

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
        newGamesThisPeriod,
        uniquePlayers,
        totalHours,
        daysWithPlays,
        hIndex,
        topMechanics,
        topGames,
        periodLabel,
      };
    },
    enabled: !!libraryId,
  });
}
