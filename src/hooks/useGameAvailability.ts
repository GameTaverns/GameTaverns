import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

interface AvailabilityResult {
  copiesOwned: number;
  activePersonalLoans: number;
  activeClubLoans: number;
  available: number;
}

/**
 * Computes availability for a game by subtracting active personal + club loans from copies_owned.
 */
export function useGameAvailability(gameId?: string, libraryId?: string) {
  return useQuery({
    queryKey: ["game-availability", gameId, libraryId],
    queryFn: async (): Promise<AvailabilityResult> => {
      if (!gameId) return { copiesOwned: 1, activePersonalLoans: 0, activeClubLoans: 0, available: 1 };

      // Get copies_owned
      const { data: game } = await (supabase as any)
        .from("games")
        .select("copies_owned")
        .eq("id", gameId)
        .single();

      const copiesOwned = game?.copies_owned ?? 1;

      // Count active personal loans
      const { count: personalCount } = await (supabase as any)
        .from("personal_loans")
        .select("id", { count: "exact", head: true })
        .eq("game_id", gameId)
        .in("status", ["active", "overdue"]);

      // Count active club loans
      const { count: clubCount } = await (supabase as any)
        .from("club_loans")
        .select("id", { count: "exact", head: true })
        .eq("game_id", gameId)
        .eq("status", "checked_out");

      // Count active library loans (game_loans)
      const { count: libraryLoanCount } = await (supabase as any)
        .from("game_loans")
        .select("id", { count: "exact", head: true })
        .eq("game_id", gameId)
        .in("status", ["approved", "active"]);

      const activePersonalLoans = personalCount ?? 0;
      const activeClubLoans = (clubCount ?? 0) + (libraryLoanCount ?? 0);
      const available = Math.max(0, copiesOwned - activePersonalLoans - activeClubLoans);

      return { copiesOwned, activePersonalLoans, activeClubLoans, available };
    },
    enabled: !!gameId,
    staleTime: 30_000,
  });
}

/**
 * Batch availability for multiple games (used in dashboards).
 * Returns a Map of gameId -> AvailabilityResult.
 */
export function useGamesAvailability(gameIds: string[]) {
  return useQuery({
    queryKey: ["games-availability", gameIds.sort().join(",")],
    queryFn: async () => {
      if (gameIds.length === 0) return new Map<string, AvailabilityResult>();

      // Get all games' copies_owned
      const { data: games } = await (supabase as any)
        .from("games")
        .select("id, copies_owned")
        .in("id", gameIds);

      // Get active personal loans
      const { data: personalLoans } = await (supabase as any)
        .from("personal_loans")
        .select("game_id")
        .in("game_id", gameIds)
        .in("status", ["active", "overdue"]);

      // Get active club loans
      const { data: clubLoans } = await (supabase as any)
        .from("club_loans")
        .select("game_id")
        .in("game_id", gameIds)
        .eq("status", "checked_out");

      // Get active library loans
      const { data: libraryLoans } = await (supabase as any)
        .from("game_loans")
        .select("game_id")
        .in("game_id", gameIds)
        .in("status", ["approved", "active"]);

      // Count loans per game
      const personalCounts = new Map<string, number>();
      (personalLoans || []).forEach((l: any) => {
        personalCounts.set(l.game_id, (personalCounts.get(l.game_id) || 0) + 1);
      });

      const clubCounts = new Map<string, number>();
      [...(clubLoans || []), ...(libraryLoans || [])].forEach((l: any) => {
        clubCounts.set(l.game_id, (clubCounts.get(l.game_id) || 0) + 1);
      });

      const result = new Map<string, AvailabilityResult>();
      (games || []).forEach((g: any) => {
        const copiesOwned = g.copies_owned ?? 1;
        const activePersonalLoans = personalCounts.get(g.id) || 0;
        const activeClubLoans = clubCounts.get(g.id) || 0;
        result.set(g.id, {
          copiesOwned,
          activePersonalLoans,
          activeClubLoans,
          available: Math.max(0, copiesOwned - activePersonalLoans - activeClubLoans),
        });
      });

      return result;
    },
    enabled: gameIds.length > 0,
    staleTime: 30_000,
  });
}
