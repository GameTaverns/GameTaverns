import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { subDays, format, startOfDay } from "date-fns";

export type TimeRange = "7d" | "30d" | "90d" | "all";

function getStartDate(range: TimeRange): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return startOfDay(subDays(new Date(), days));
}

export interface AdminSummary {
  totalUsers: number;
  totalLibraries: number;
  activeLibraries: number;
  premiumLibraries: number;
  totalGames: number;
  totalSessions: number;
  totalClubs: number;
  totalLoans: number;
}

export interface GrowthPoint {
  date: string;
  count: number;
}

export interface EngagementStats {
  gamesAdded: number;
  sessionsLogged: number;
  ratingsSubmitted: number;
  forumThreads: number;
  forumReplies: number;
  messagesExchanged: number;
  loansCreated: number;
}

export function useAdminSummary() {
  return useQuery({
    queryKey: ["admin-summary"],
    queryFn: async (): Promise<AdminSummary> => {
      const [users, libraries, activeLibs, premiumLibs, games, sessions, clubs, loans] = await Promise.all([
        supabase.from("user_profiles").select("*", { count: "exact", head: true }),
        supabase.from("libraries").select("*", { count: "exact", head: true }),
        supabase.from("libraries").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("libraries").select("*", { count: "exact", head: true }).eq("is_premium", true),
        supabase.from("games").select("*", { count: "exact", head: true }),
        supabase.from("game_sessions").select("*", { count: "exact", head: true }),
        supabase.from("clubs").select("*", { count: "exact", head: true }),
        supabase.from("game_loans").select("*", { count: "exact", head: true }),
      ]);

      return {
        totalUsers: users.count || 0,
        totalLibraries: libraries.count || 0,
        activeLibraries: activeLibs.count || 0,
        premiumLibraries: premiumLibs.count || 0,
        totalGames: games.count || 0,
        totalSessions: sessions.count || 0,
        totalClubs: clubs.count || 0,
        totalLoans: loans.count || 0,
      };
    },
  });
}

export function useUserGrowth(range: TimeRange) {
  return useQuery({
    queryKey: ["admin-user-growth", range],
    queryFn: async (): Promise<GrowthPoint[]> => {
      const startDate = getStartDate(range);
      let query = supabase.from("user_profiles").select("created_at").order("created_at", { ascending: true });
      if (startDate) query = query.gte("created_at", startDate.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      const byDate = new Map<string, number>();
      
      if (range !== "all" && startDate) {
        const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
        for (let i = days - 1; i >= 0; i--) {
          byDate.set(format(subDays(new Date(), i), "yyyy-MM-dd"), 0);
        }
      }

      data?.forEach((row) => {
        const date = format(new Date(row.created_at), "yyyy-MM-dd");
        byDate.set(date, (byDate.get(date) || 0) + 1);
      });

      return Array.from(byDate.entries()).map(([date, count]) => ({ date, count }));
    },
  });
}

export function useLibraryGrowth(range: TimeRange) {
  return useQuery({
    queryKey: ["admin-library-growth", range],
    queryFn: async (): Promise<GrowthPoint[]> => {
      const startDate = getStartDate(range);
      let query = supabase.from("libraries").select("created_at").order("created_at", { ascending: true });
      if (startDate) query = query.gte("created_at", startDate.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      const byDate = new Map<string, number>();

      if (range !== "all" && startDate) {
        const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
        for (let i = days - 1; i >= 0; i--) {
          byDate.set(format(subDays(new Date(), i), "yyyy-MM-dd"), 0);
        }
      }

      data?.forEach((row) => {
        const date = format(new Date(row.created_at), "yyyy-MM-dd");
        byDate.set(date, (byDate.get(date) || 0) + 1);
      });

      return Array.from(byDate.entries()).map(([date, count]) => ({ date, count }));
    },
  });
}

export function useEngagementStats(range: TimeRange) {
  return useQuery({
    queryKey: ["admin-engagement", range],
    queryFn: async (): Promise<EngagementStats> => {
      const startDate = getStartDate(range);
      const gte = startDate ? startDate.toISOString() : undefined;

      const mkQ = <T extends "games" | "game_sessions" | "catalog_ratings" | "forum_threads" | "forum_replies" | "direct_messages" | "game_loans">(t: T) => {
        const q = supabase.from(t).select("*", { count: "exact", head: true });
        return gte ? q.gte("created_at", gte) : q;
      };

      const [games, sessions, ratings, threads, replies, messages, loans] = await Promise.all([
        mkQ("games"), mkQ("game_sessions"), mkQ("catalog_ratings"),
        mkQ("forum_threads"), mkQ("forum_replies"), mkQ("direct_messages"), mkQ("game_loans"),
      ]);

      return {
        gamesAdded: games.count || 0,
        sessionsLogged: sessions.count || 0,
        ratingsSubmitted: ratings.count || 0,
        forumThreads: threads.count || 0,
        forumReplies: replies.count || 0,
        messagesExchanged: messages.count || 0,
        loansCreated: loans.count || 0,
      };
    },
  });
}

export function useActivityTrend(range: TimeRange) {
  return useQuery({
    queryKey: ["admin-activity-trend", range],
    queryFn: async (): Promise<GrowthPoint[]> => {
      const startDate = getStartDate(range);
      let query = supabase.from("activity_events").select("created_at").order("created_at", { ascending: true });
      if (startDate) query = query.gte("created_at", startDate.toISOString());

      const { data, error } = await query.limit(1000);
      if (error) throw error;

      const byDate = new Map<string, number>();

      if (range !== "all" && startDate) {
        const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
        for (let i = days - 1; i >= 0; i--) {
          byDate.set(format(subDays(new Date(), i), "yyyy-MM-dd"), 0);
        }
      }

      data?.forEach((row) => {
        const date = format(new Date(row.created_at), "yyyy-MM-dd");
        byDate.set(date, (byDate.get(date) || 0) + 1);
      });

      return Array.from(byDate.entries()).map(([date, count]) => ({ date, count }));
    },
  });
}

/** DAU approximation from activity_events */
export function useDAUTrend(range: TimeRange) {
  return useQuery({
    queryKey: ["admin-dau-trend", range],
    queryFn: async (): Promise<GrowthPoint[]> => {
      const startDate = getStartDate(range);
      let query = supabase.from("activity_events").select("created_at, user_id").order("created_at", { ascending: true });
      if (startDate) query = query.gte("created_at", startDate.toISOString());

      const { data, error } = await query.limit(1000);
      if (error) throw error;

      // Group unique users per day
      const dayUsers = new Map<string, Set<string>>();

      if (range !== "all" && startDate) {
        const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
        for (let i = days - 1; i >= 0; i--) {
          dayUsers.set(format(subDays(new Date(), i), "yyyy-MM-dd"), new Set());
        }
      }

      data?.forEach((row) => {
        const date = format(new Date(row.created_at), "yyyy-MM-dd");
        if (!dayUsers.has(date)) dayUsers.set(date, new Set());
        dayUsers.get(date)!.add(row.user_id);
      });

      return Array.from(dayUsers.entries()).map(([date, users]) => ({
        date,
        count: users.size,
      }));
    },
  });
}
