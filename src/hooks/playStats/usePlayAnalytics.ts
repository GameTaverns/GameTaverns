import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import {
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  format, parseISO, getDay, eachDayOfInterval,
  subMonths,
} from "date-fns";
import type { StatsPeriod } from "./types";
import { fetchLibrarySessionsForPeriod } from "./fetchLibrarySessions";

export interface DayOfWeekData {
  day: string;
  shortDay: string;
  plays: number;
}

export interface DailyPlayData {
  date: string;
  plays: number;
}

export interface PlayerCountData {
  playerCount: string;
  sessions: number;
}

export interface PlayerWinData {
  name: string;
  wins: number;
  plays: number;
  winRate: number;
}

export interface CalendarHeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface PlayAnalytics {
  dayOfWeek: DayOfWeekData[];
  dailyPlays: DailyPlayData[];
  playerCounts: PlayerCountData[];
  topPlayers: PlayerWinData[];
  calendarHeatmap: CalendarHeatmapDay[];
  avgPlayDuration: number;
  longestStreak: number;
  currentStreak: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function usePlayAnalytics(
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
    queryKey: ["play-analytics", libraryId, periodKey, period],
    queryFn: async (): Promise<PlayAnalytics> => {
      if (!libraryId) throw new Error("No library ID");

      // Fetch sessions for the period
      const sessions = await fetchLibrarySessionsForPeriod({
        libraryId,
        periodStartIso: periodStart.toISOString(),
        periodEndIso: periodEnd.toISOString(),
      });

      // === Day of Week ===
      const dowCounts = new Array(7).fill(0);
      sessions.forEach((s) => {
        const dow = getDay(parseISO(s.played_at));
        dowCounts[dow]++;
      });
      const dayOfWeek: DayOfWeekData[] = dowCounts.map((plays, i) => ({
        day: DAY_NAMES[i],
        shortDay: SHORT_DAYS[i],
        plays,
      }));

      // === Daily plays ===
      const effectiveEnd = periodEnd > new Date() ? new Date() : periodEnd;
      const allDays = eachDayOfInterval({ start: periodStart, end: effectiveEnd });
      const dailyMap = new Map<string, number>();
      allDays.forEach((d) => dailyMap.set(format(d, "yyyy-MM-dd"), 0));
      sessions.forEach((s) => {
        const dateKey = format(parseISO(s.played_at), "yyyy-MM-dd");
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      });
      const dailyPlays: DailyPlayData[] = Array.from(dailyMap.entries()).map(([date, plays]) => ({
        date,
        plays,
      }));

      // === Calendar heatmap (last 6 months from target) ===
      const heatmapStart = startOfMonth(subMonths(target, 5));
      const heatmapEnd = effectiveEnd;
      let heatmapSessions = sessions;
      // If heatmap range extends beyond the period, fetch more data
      if (heatmapStart < periodStart) {
        heatmapSessions = await fetchLibrarySessionsForPeriod({
          libraryId,
          periodStartIso: heatmapStart.toISOString(),
          periodEndIso: heatmapEnd.toISOString(),
        });
      }
      const heatmapDays = eachDayOfInterval({ start: heatmapStart, end: heatmapEnd });
      const heatmapMap = new Map<string, number>();
      heatmapDays.forEach((d) => heatmapMap.set(format(d, "yyyy-MM-dd"), 0));
      heatmapSessions.forEach((s) => {
        const dateKey = format(parseISO(s.played_at), "yyyy-MM-dd");
        if (heatmapMap.has(dateKey)) {
          heatmapMap.set(dateKey, (heatmapMap.get(dateKey) || 0) + 1);
        }
      });
      const maxPlays = Math.max(...Array.from(heatmapMap.values()), 1);
      const calendarHeatmap: CalendarHeatmapDay[] = Array.from(heatmapMap.entries()).map(([date, count]) => ({
        date,
        count,
        level: count === 0 ? 0 : count <= maxPlays * 0.25 ? 1 : count <= maxPlays * 0.5 ? 2 : count <= maxPlays * 0.75 ? 3 : 4,
      }));

      // === Avg duration ===
      const durSessions = sessions.filter((s) => s.duration_minutes && s.duration_minutes > 0);
      const avgPlayDuration = durSessions.length > 0
        ? Math.round(durSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / durSessions.length)
        : 0;

      // === Streaks ===
      const sortedDates = Array.from(new Set(sessions.map((s) => format(parseISO(s.played_at), "yyyy-MM-dd")))).sort();
      let longestStreak = 0;
      let currentStreak = 0;
      let tempStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        if (diffDays === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
      if (sortedDates.length === 0) longestStreak = 0;

      // Current streak (counting back from today)
      const today = format(new Date(), "yyyy-MM-dd");
      if (sortedDates.includes(today)) {
        currentStreak = 1;
        for (let i = sortedDates.indexOf(today) - 1; i >= 0; i--) {
          const prev = new Date(sortedDates[i]);
          const curr = new Date(sortedDates[i + 1]);
          if (Math.round((curr.getTime() - prev.getTime()) / 86400000) === 1) {
            currentStreak++;
          } else break;
        }
      }

      // === Player counts & win data ===
      const sessionIds = sessions.map((s) => s.id);
      let playerCounts: PlayerCountData[] = [];
      let topPlayers: PlayerWinData[] = [];

      if (sessionIds.length > 0) {
        const BATCH = 200;
        const allPlayers: any[] = [];
        for (let i = 0; i < sessionIds.length; i += BATCH) {
          const batch = sessionIds.slice(i, i + BATCH);
          const { data, error } = await supabase
            .from("game_session_players")
            .select("session_id, player_name, is_winner")
            .in("session_id", batch);
          if (error) throw error;
          if (data) allPlayers.push(...data);
        }

        // Player count distribution
        const sessionPlayerCounts = new Map<string, number>();
        allPlayers.forEach((p) => {
          sessionPlayerCounts.set(p.session_id, (sessionPlayerCounts.get(p.session_id) || 0) + 1);
        });
        const countDist = new Map<number, number>();
        sessionPlayerCounts.forEach((count) => {
          countDist.set(count, (countDist.get(count) || 0) + 1);
        });
        playerCounts = Array.from(countDist.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([count, sessions]) => ({
            playerCount: `${count}p`,
            sessions,
          }));

        // Win rates
        const playerStats = new Map<string, { wins: number; plays: number }>();
        allPlayers.forEach((p) => {
          const name = p.player_name.trim();
          const existing = playerStats.get(name) || { wins: 0, plays: 0 };
          existing.plays++;
          if (p.is_winner) existing.wins++;
          playerStats.set(name, existing);
        });
        topPlayers = Array.from(playerStats.entries())
          .map(([name, s]) => ({
            name,
            wins: s.wins,
            plays: s.plays,
            winRate: s.plays > 0 ? Math.round((s.wins / s.plays) * 100) : 0,
          }))
          .filter((p) => p.plays >= 2)
          .sort((a, b) => b.wins - a.wins)
          .slice(0, 10);
      }

      return {
        dayOfWeek,
        dailyPlays,
        playerCounts,
        topPlayers,
        calendarHeatmap,
        avgPlayDuration,
        longestStreak,
        currentStreak,
      };
    },
    enabled: !!libraryId,
  });
}
