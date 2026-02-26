import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { format, parseISO, subDays } from "date-fns";

export interface ClubAnalytics {
  totalMembers: number;
  totalGamesAcrossLibraries: number;
  totalEvents: number;
  upcomingEvents: number;
  recentActivity: { date: string; count: number }[];
  topGamesAcrossClub: { title: string; plays: number }[];
  memberActivity: { libraryName: string; gamesCount: number; sessionsCount: number }[];
}

export function useClubAnalytics(clubId: string | null) {
  return useQuery({
    queryKey: ["club-analytics", clubId],
    queryFn: async (): Promise<ClubAnalytics> => {
      if (!clubId) throw new Error("No club ID");

      // Get member libraries
      const { data: clubLibs, error: clError } = await supabase
        .from("club_libraries")
        .select("library_id, library:libraries(name)")
        .eq("club_id", clubId);
      if (clError) throw clError;

      const libraryIds = (clubLibs || []).map((cl: any) => cl.library_id);
      const totalMembers = libraryIds.length;

      if (totalMembers === 0) {
        return {
          totalMembers: 0, totalGamesAcrossLibraries: 0,
          totalEvents: 0, upcomingEvents: 0,
          recentActivity: [], topGamesAcrossClub: [], memberActivity: [],
        };
      }

      // Events
      const { count: totalEvents } = await supabase
        .from("club_events")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId);

      const { count: upcomingEvents } = await supabase
        .from("club_events")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId)
        .gte("event_date", new Date().toISOString());

      // Games across all member libraries
      const BATCH = 50;
      let totalGamesAcrossLibraries = 0;
      const memberActivity: ClubAnalytics["memberActivity"] = [];
      const allGameTitles = new Map<string, number>();

      for (let i = 0; i < libraryIds.length; i += BATCH) {
        const batch = libraryIds.slice(i, i + BATCH);
        const { data: games } = await supabase
          .from("games")
          .select("id, title, library_id")
          .in("library_id", batch)
          .eq("is_expansion", false);

        if (games) {
          totalGamesAcrossLibraries += games.length;

          // Per-library stats
          const libGameCounts = new Map<string, number>();
          games.forEach((g: any) => {
            libGameCounts.set(g.library_id, (libGameCounts.get(g.library_id) || 0) + 1);
          });

          // Get sessions for these games
          const gameIds = games.map((g: any) => g.id);
          if (gameIds.length > 0) {
            for (let j = 0; j < gameIds.length; j += 200) {
              const gBatch = gameIds.slice(j, j + 200);
              const { data: sessions } = await supabase
                .from("game_sessions")
                .select("game_id")
                .in("game_id", gBatch);

              sessions?.forEach((s: any) => {
                const game = games.find((g: any) => g.id === s.game_id);
                if (game) {
                  allGameTitles.set(game.title, (allGameTitles.get(game.title) || 0) + 1);
                }
              });
            }
          }
        }
      }

      // Build member activity
      for (const cl of (clubLibs || [])) {
        const libName = (cl as any).library?.name || "Unknown";
        const { count: gCount } = await supabase
          .from("games")
          .select("*", { count: "exact", head: true })
          .eq("library_id", cl.library_id)
          .eq("is_expansion", false);

        const { count: sCount } = await supabase
          .from("game_sessions")
          .select("*, games!inner(library_id)", { count: "exact", head: true })
          .eq("games.library_id", cl.library_id);

        memberActivity.push({
          libraryName: libName,
          gamesCount: gCount || 0,
          sessionsCount: sCount || 0,
        });
      }

      memberActivity.sort((a, b) => b.sessionsCount - a.sessionsCount);

      // Top games
      const topGamesAcrossClub = Array.from(allGameTitles.entries())
        .map(([title, plays]) => ({ title, plays }))
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 10);

      return {
        totalMembers,
        totalGamesAcrossLibraries,
        totalEvents: totalEvents || 0,
        upcomingEvents: upcomingEvents || 0,
        recentActivity: [],
        topGamesAcrossClub,
        memberActivity,
      };
    },
    enabled: !!clubId,
  });
}
