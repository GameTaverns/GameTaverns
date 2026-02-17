import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";

export interface TopNineGame {
  id: string;
  title: string;
  image_url: string | null;
  playCount: number;
}

interface UseTopNineGamesOptions {
  libraryId: string | null;
  year: number;
  month: number | null; // null = full year
}

export function useTopNineGames({ libraryId, year, month }: UseTopNineGamesOptions) {
  return useQuery({
    queryKey: ["top-nine-games", libraryId, year, month],
    queryFn: async (): Promise<TopNineGame[]> => {
      if (!libraryId) throw new Error("No library ID");

      // Determine date range
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

      // Get all sessions in the date range for this library
      const { data: sessions, error } = await supabase
        .from("game_sessions")
        .select("game_id, games!inner(library_id, title, image_url, is_expansion)")
        .eq("games.library_id", libraryId)
        .eq("games.is_expansion", false)
        .gte("played_at", rangeStart.toISOString())
        .lte("played_at", rangeEnd.toISOString());

      if (error) throw error;
      if (!sessions || sessions.length === 0) return [];

      // Count plays per game
      const playCounts = new Map<string, { title: string; image_url: string | null; count: number }>();

      for (const session of sessions) {
        const gameId = session.game_id;
        const game = session.games as any;
        const existing = playCounts.get(gameId);
        if (existing) {
          existing.count++;
        } else {
          playCounts.set(gameId, {
            title: game.title,
            image_url: game.image_url,
            count: 1,
          });
        }
      }

      // Sort by play count, take top 9
      return Array.from(playCounts.entries())
        .map(([id, data]) => ({
          id,
          title: data.title,
          image_url: data.image_url,
          playCount: data.count,
        }))
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 9);
    },
    enabled: !!libraryId,
  });
}
