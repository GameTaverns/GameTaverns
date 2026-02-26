import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface ClubAnalytics {
  totalMembers: number;
  totalGamesAcrossLibraries: number;
  uniqueTitles: number;
  totalEvents: number;
  upcomingEvents: number;
  totalSessionsAcrossClub: number;
  avgGamesPerMember: number;
  avgSessionsPerMember: number;
  topGamesAcrossClub: { title: string; plays: number }[];
  memberActivity: { libraryName: string; gamesCount: number; sessionsCount: number }[];
  gameDiversity: { label: string; count: number }[];
  playerCountDistribution: { label: string; count: number }[];
  recentSessionTrend: { date: string; count: number }[];
  sharedGames: { title: string; owners: number }[];
}

export function useClubAnalytics(clubId: string | null) {
  return useQuery({
    queryKey: ["club-analytics", clubId],
    queryFn: async (): Promise<ClubAnalytics> => {
      if (!clubId) throw new Error("No club ID");

      const { data: clubLibs, error: clError } = await supabase
        .from("club_libraries")
        .select("library_id, library:libraries(name)")
        .eq("club_id", clubId);
      if (clError) throw clError;

      const libraryIds = (clubLibs || []).map((cl: any) => cl.library_id);
      const totalMembers = libraryIds.length;

      if (totalMembers === 0) {
        return {
          totalMembers: 0, totalGamesAcrossLibraries: 0, uniqueTitles: 0,
          totalEvents: 0, upcomingEvents: 0, totalSessionsAcrossClub: 0,
          avgGamesPerMember: 0, avgSessionsPerMember: 0,
          topGamesAcrossClub: [], memberActivity: [], gameDiversity: [],
          playerCountDistribution: [], recentSessionTrend: [], sharedGames: [],
        };
      }

      // Events
      const [{ count: totalEvents }, { count: upcomingEvents }] = await Promise.all([
        supabase.from("club_events").select("*", { count: "exact", head: true }).eq("club_id", clubId),
        supabase.from("club_events").select("*", { count: "exact", head: true }).eq("club_id", clubId).gte("event_date", new Date().toISOString()),
      ]);

      // Fetch all games across member libraries
      const BATCH = 50;
      let allGames: any[] = [];
      for (let i = 0; i < libraryIds.length; i += BATCH) {
        const batch = libraryIds.slice(i, i + BATCH);
        const { data: games } = await supabase
          .from("games")
          .select("id, title, library_id, game_type, min_players, max_players, bgg_id")
          .in("library_id", batch)
          .eq("is_expansion", false);
        if (games) allGames = allGames.concat(games);
      }

      const totalGamesAcrossLibraries = allGames.length;

      // Unique titles by bgg_id or lowered title
      const titleSet = new Set<string>();
      allGames.forEach((g) => titleSet.add(g.bgg_id || g.title.toLowerCase()));
      const uniqueTitles = titleSet.size;

      // Shared games (owned by 2+ members)
      const titleOwners = new Map<string, Set<string>>();
      const titleDisplay = new Map<string, string>();
      allGames.forEach((g) => {
        const key = g.bgg_id || g.title.toLowerCase();
        if (!titleOwners.has(key)) titleOwners.set(key, new Set());
        titleOwners.get(key)!.add(g.library_id);
        titleDisplay.set(key, g.title);
      });
      const sharedGames = Array.from(titleOwners.entries())
        .filter(([, owners]) => owners.size >= 2)
        .map(([key, owners]) => ({ title: titleDisplay.get(key)!, owners: owners.size }))
        .sort((a, b) => b.owners - a.owners)
        .slice(0, 10);

      // Game type diversity
      const typeCounts = new Map<string, number>();
      allGames.forEach((g) => {
        const t = g.game_type || "Unknown";
        typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
      });
      const gameDiversity = Array.from(typeCounts.entries())
        .map(([label, count]) => ({ label: label.replace(/_/g, " "), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Player count distribution
      const playerBuckets: Record<string, number> = { "Solo": 0, "2P": 0, "3-4P": 0, "5-6P": 0, "7+P": 0 };
      allGames.forEach((g) => {
        const max = g.max_players || g.min_players || 1;
        if (max === 1) playerBuckets["Solo"]++;
        else if (max <= 2) playerBuckets["2P"]++;
        else if (max <= 4) playerBuckets["3-4P"]++;
        else if (max <= 6) playerBuckets["5-6P"]++;
        else playerBuckets["7+P"]++;
      });
      const playerCountDistribution = Object.entries(playerBuckets)
        .map(([label, count]) => ({ label, count }))
        .filter((d) => d.count > 0);

      // Sessions across club + play trend
      const gameIds = allGames.map((g) => g.id);
      let totalSessionsAcrossClub = 0;
      const allSessionPlayCounts = new Map<string, number>();
      const sessionDates = new Map<string, number>();

      for (let j = 0; j < gameIds.length; j += 200) {
        const gBatch = gameIds.slice(j, j + 200);
        const { data: sessions } = await supabase
          .from("game_sessions")
          .select("game_id, played_at")
          .in("game_id", gBatch);

        if (sessions) {
          totalSessionsAcrossClub += sessions.length;
          sessions.forEach((s: any) => {
            const game = allGames.find((g: any) => g.id === s.game_id);
            if (game) {
              allSessionPlayCounts.set(game.title, (allSessionPlayCounts.get(game.title) || 0) + 1);
            }
            if (s.played_at) {
              const date = s.played_at.slice(0, 7); // yyyy-MM
              sessionDates.set(date, (sessionDates.get(date) || 0) + 1);
            }
          });
        }
      }

      const topGamesAcrossClub = Array.from(allSessionPlayCounts.entries())
        .map(([title, plays]) => ({ title, plays }))
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 10);

      const recentSessionTrend = Array.from(sessionDates.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-12);

      // Per-member activity
      const memberActivity: ClubAnalytics["memberActivity"] = [];
      const libGameCounts = new Map<string, number>();
      const libSessionCounts = new Map<string, number>();
      allGames.forEach((g) => libGameCounts.set(g.library_id, (libGameCounts.get(g.library_id) || 0) + 1));

      for (const cl of (clubLibs || [])) {
        const libName = (cl as any).library?.name || "Unknown";
        const gCount = libGameCounts.get(cl.library_id) || 0;

        // Count sessions for this library's games
        const libGameIds = allGames.filter((g) => g.library_id === cl.library_id).map((g) => g.id);
        let sCount = 0;
        if (libGameIds.length > 0) {
          for (let j = 0; j < libGameIds.length; j += 200) {
            const batch = libGameIds.slice(j, j + 200);
            const { count } = await supabase
              .from("game_sessions")
              .select("*", { count: "exact", head: true })
              .in("game_id", batch);
            sCount += count || 0;
          }
        }

        memberActivity.push({ libraryName: libName, gamesCount: gCount, sessionsCount: sCount });
      }

      memberActivity.sort((a, b) => b.sessionsCount - a.sessionsCount);

      const avgGamesPerMember = totalMembers > 0 ? Math.round(totalGamesAcrossLibraries / totalMembers) : 0;
      const avgSessionsPerMember = totalMembers > 0 ? Math.round(totalSessionsAcrossClub / totalMembers) : 0;

      return {
        totalMembers,
        totalGamesAcrossLibraries,
        uniqueTitles,
        totalEvents: totalEvents || 0,
        upcomingEvents: upcomingEvents || 0,
        totalSessionsAcrossClub,
        avgGamesPerMember,
        avgSessionsPerMember,
        topGamesAcrossClub,
        memberActivity,
        gameDiversity,
        playerCountDistribution,
        recentSessionTrend,
        sharedGames,
      };
    },
    enabled: !!clubId,
  });
}
