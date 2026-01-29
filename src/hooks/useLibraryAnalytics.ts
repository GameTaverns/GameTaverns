import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, format } from "date-fns";

export interface LibraryAnalytics {
  totalGames: number;
  totalPlays: number;
  uniquePlayers: number;
  totalRatings: number;
  averageRating: number;
  wishlistVotes: number;
  unreadMessages: number;
}

export interface PlayTrend {
  date: string;
  plays: number;
}

export interface TopGame {
  id: string;
  title: string;
  image_url: string | null;
  playCount: number;
  averageRating: number | null;
}

export interface RatingDistribution {
  rating: number;
  count: number;
}

export function useLibraryAnalytics(libraryId: string | null) {
  // Summary stats
  const summaryQuery = useQuery({
    queryKey: ["library-analytics-summary", libraryId],
    queryFn: async (): Promise<LibraryAnalytics> => {
      if (!libraryId) throw new Error("No library ID");

      // Get game count
      const { count: totalGames } = await supabase
        .from("games")
        .select("*", { count: "exact", head: true })
        .eq("library_id", libraryId)
        .eq("is_expansion", false);

      // Get game IDs for this library
      const { data: games } = await supabase
        .from("games")
        .select("id")
        .eq("library_id", libraryId);

      const gameIds = games?.map(g => g.id) || [];

      if (gameIds.length === 0) {
        return {
          totalGames: 0,
          totalPlays: 0,
          uniquePlayers: 0,
          totalRatings: 0,
          averageRating: 0,
          wishlistVotes: 0,
          unreadMessages: 0,
        };
      }

      // Get play stats
      const { data: sessions } = await supabase
        .from("game_sessions")
        .select("id")
        .in("game_id", gameIds);

      const sessionIds = sessions?.map(s => s.id) || [];

      // Get unique players
      const { data: players } = await supabase
        .from("game_session_players")
        .select("player_name")
        .in("session_id", sessionIds);

      const uniquePlayerNames = new Set(players?.map(p => p.player_name) || []);

      // Get ratings summary
      const { data: ratingsSummary } = await supabase
        .from("game_ratings_summary")
        .select("*")
        .in("game_id", gameIds);

      const totalRatings = ratingsSummary?.reduce((sum, r) => sum + (r.rating_count || 0), 0) || 0;
      const weightedSum = ratingsSummary?.reduce((sum, r) => 
        sum + ((r.average_rating || 0) * (r.rating_count || 0)), 0) || 0;
      const averageRating = totalRatings > 0 ? weightedSum / totalRatings : 0;

      // Get wishlist votes
      const { data: wishlistSummary } = await supabase
        .from("game_wishlist_summary")
        .select("vote_count")
        .in("game_id", gameIds);

      const wishlistVotes = wishlistSummary?.reduce((sum, w) => sum + (Number(w.vote_count) || 0), 0) || 0;

      // Get unread messages
      const { count: unreadMessages } = await supabase
        .from("game_messages")
        .select("*", { count: "exact", head: true })
        .in("game_id", gameIds)
        .eq("is_read", false);

      return {
        totalGames: totalGames || 0,
        totalPlays: sessions?.length || 0,
        uniquePlayers: uniquePlayerNames.size,
        totalRatings,
        averageRating: Math.round(averageRating * 10) / 10,
        wishlistVotes,
        unreadMessages: unreadMessages || 0,
      };
    },
    enabled: !!libraryId,
  });

  // Play trends (last 30 days)
  const trendsQuery = useQuery({
    queryKey: ["library-analytics-trends", libraryId],
    queryFn: async (): Promise<PlayTrend[]> => {
      if (!libraryId) throw new Error("No library ID");

      const thirtyDaysAgo = subDays(new Date(), 30);

      // Get game IDs
      const { data: games } = await supabase
        .from("games")
        .select("id")
        .eq("library_id", libraryId);

      const gameIds = games?.map(g => g.id) || [];

      if (gameIds.length === 0) {
        return [];
      }

      const { data: sessions } = await supabase
        .from("game_sessions")
        .select("played_at")
        .in("game_id", gameIds)
        .gte("played_at", thirtyDaysAgo.toISOString())
        .order("played_at", { ascending: true });

      // Group by date
      const playsByDate = new Map<string, number>();
      
      // Initialize all days
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        playsByDate.set(date, 0);
      }

      // Count plays per day
      sessions?.forEach(session => {
        const date = format(new Date(session.played_at), "yyyy-MM-dd");
        playsByDate.set(date, (playsByDate.get(date) || 0) + 1);
      });

      return Array.from(playsByDate.entries()).map(([date, plays]) => ({
        date,
        plays,
      }));
    },
    enabled: !!libraryId,
  });

  // Top games by plays
  const topGamesQuery = useQuery({
    queryKey: ["library-analytics-top-games", libraryId],
    queryFn: async (): Promise<TopGame[]> => {
      if (!libraryId) throw new Error("No library ID");

      // Get games with session counts
      const { data: games } = await supabase
        .from("games")
        .select(`
          id,
          title,
          image_url
        `)
        .eq("library_id", libraryId)
        .eq("is_expansion", false);

      if (!games || games.length === 0) return [];

      // Get session counts per game
      const gameStats = await Promise.all(
        games.map(async (game) => {
          const { count: playCount } = await supabase
            .from("game_sessions")
            .select("*", { count: "exact", head: true })
            .eq("game_id", game.id);

          const { data: ratingData } = await supabase
            .from("game_ratings_summary")
            .select("average_rating")
            .eq("game_id", game.id)
            .maybeSingle();

          return {
            id: game.id,
            title: game.title,
            image_url: game.image_url,
            playCount: playCount || 0,
            averageRating: ratingData?.average_rating || null,
          };
        })
      );

      // Sort by play count and take top 10
      return gameStats
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 10);
    },
    enabled: !!libraryId,
  });

  // Rating distribution
  const ratingDistributionQuery = useQuery({
    queryKey: ["library-analytics-rating-distribution", libraryId],
    queryFn: async (): Promise<RatingDistribution[]> => {
      if (!libraryId) throw new Error("No library ID");

      // Get game IDs
      const { data: games } = await supabase
        .from("games")
        .select("id")
        .eq("library_id", libraryId);

      const gameIds = games?.map(g => g.id) || [];

      if (gameIds.length === 0) {
        return [1, 2, 3, 4, 5].map(rating => ({ rating, count: 0 }));
      }

      // Get all ratings for library games
      const { data: ratings } = await supabase
        .from("game_ratings_library_view")
        .select("rating")
        .in("game_id", gameIds);

      // Count by rating
      const distribution = new Map<number, number>();
      for (let i = 1; i <= 5; i++) {
        distribution.set(i, 0);
      }

      ratings?.forEach(r => {
        if (r.rating) {
          distribution.set(r.rating, (distribution.get(r.rating) || 0) + 1);
        }
      });

      return Array.from(distribution.entries()).map(([rating, count]) => ({
        rating,
        count,
      }));
    },
    enabled: !!libraryId,
  });

  return {
    summary: summaryQuery.data,
    summaryLoading: summaryQuery.isLoading,
    trends: trendsQuery.data || [],
    trendsLoading: trendsQuery.isLoading,
    topGames: topGamesQuery.data || [],
    topGamesLoading: topGamesQuery.isLoading,
    ratingDistribution: ratingDistributionQuery.data || [],
    ratingDistributionLoading: ratingDistributionQuery.isLoading,
  };
}
