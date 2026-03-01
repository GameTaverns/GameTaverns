import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, format } from "date-fns";

export interface MonthlyStats {
  totalPlays: number;
  hIndex: number;
  uniqueGames: number;
  newGames: number;
  totalHours: number;
  daysPlayed: number;
  topGames: {
    id: string;
    title: string;
    image_url: string | null;
    playCount: number;
  }[];
  dailyPlays: { date: string; count: number }[];
  topCategories: { name: string; percentage: number }[];
}

interface UseMonthlyStatsOptions {
  libraryId: string | null;
  year: number;
  month: number | null;
}

export function useMonthlyStats({ libraryId, year, month }: UseMonthlyStatsOptions) {
  return useQuery({
    queryKey: ["monthly-stats", libraryId, year, month],
    queryFn: async (): Promise<MonthlyStats> => {
      if (!libraryId) throw new Error("No library ID");

      let rangeStart: Date;
      let rangeEnd: Date;
      if (month !== null) {
        const date = new Date(year, month, 1);
        rangeStart = startOfMonth(date);
        rangeEnd = endOfMonth(date);
      } else {
        rangeStart = startOfYear(new Date(year, 0, 1));
        rangeEnd = endOfYear(new Date(year, 0, 1));
      }

      // Fetch sessions with game info
      const { data: sessions, error } = await supabase
        .from("game_sessions")
        .select("id, game_id, played_at, duration_minutes, games!inner(library_id, title, image_url, is_expansion, game_type)")
        .eq("games.library_id", libraryId)
        .eq("games.is_expansion", false)
        .gte("played_at", rangeStart.toISOString())
        .lte("played_at", rangeEnd.toISOString());

      if (error) throw error;
      if (!sessions || sessions.length === 0) {
        return {
          totalPlays: 0, hIndex: 0, uniqueGames: 0, newGames: 0,
          totalHours: 0, daysPlayed: 0, topGames: [], dailyPlays: [], topCategories: [],
        };
      }

      const totalPlays = sessions.length;

      // Total hours
      const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const totalHours = Math.round(totalMinutes / 60);

      // Days played
      const uniqueDays = new Set(sessions.map(s => format(new Date(s.played_at), "yyyy-MM-dd")));
      const daysPlayed = uniqueDays.size;

      // Per-game counts
      const gameCounts = new Map<string, { title: string; image_url: string | null; count: number; gameType: string | null }>();
      for (const s of sessions) {
        const game = s.games as any;
        const existing = gameCounts.get(s.game_id);
        if (existing) {
          existing.count++;
        } else {
          gameCounts.set(s.game_id, {
            title: game.title,
            image_url: game.image_url,
            count: 1,
            gameType: game.game_type,
          });
        }
      }

      // H-Index
      const counts = Array.from(gameCounts.values()).map(g => g.count).sort((a, b) => b - a);
      let hIndex = 0;
      for (let i = 0; i < counts.length; i++) {
        if (counts[i] >= i + 1) hIndex = i + 1;
        else break;
      }

      const uniqueGames = gameCounts.size;

      // New games: check if any session for this game existed BEFORE rangeStart
      const gameIds = Array.from(gameCounts.keys());
      let newGames = 0;
      if (gameIds.length > 0) {
        const { data: priorSessions } = await supabase
          .from("game_sessions")
          .select("game_id")
          .in("game_id", gameIds)
          .lt("played_at", rangeStart.toISOString());

        const priorGameIds = new Set((priorSessions || []).map(s => s.game_id));
        newGames = gameIds.filter(id => !priorGameIds.has(id)).length;
      }

      // Top games (up to 9)
      const topGames = Array.from(gameCounts.entries())
        .map(([id, data]) => ({ id, title: data.title, image_url: data.image_url, playCount: data.count }))
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 9);

      // Daily plays chart
      const allDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      const dayCountMap = new Map<string, number>();
      for (const s of sessions) {
        const day = format(new Date(s.played_at), "yyyy-MM-dd");
        dayCountMap.set(day, (dayCountMap.get(day) || 0) + 1);
      }
      const dailyPlays = allDays.map(d => ({
        date: format(d, "yyyy-MM-dd"),
        count: dayCountMap.get(format(d, "yyyy-MM-dd")) || 0,
      }));

      // Top categories (game_type)
      const categoryCounts = new Map<string, number>();
      for (const [, data] of gameCounts) {
        const cat = data.gameType || "Uncategorized";
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + data.count);
      }
      const sortedCategories = Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const topCategories = sortedCategories.map(([name, count]) => ({
        name: formatGameType(name),
        percentage: Math.round((count / totalPlays) * 100),
      }));

      return {
        totalPlays, hIndex, uniqueGames, newGames,
        totalHours, daysPlayed, topGames, dailyPlays, topCategories,
      };
    },
    enabled: !!libraryId,
  });
}

function formatGameType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
