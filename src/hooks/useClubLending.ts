import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ──

export interface ClubLendingSettings {
  id: string;
  club_id: string;
  lending_enabled: boolean;
  max_concurrent_loans: number;
  default_duration_hours: number;
  require_contact_info: boolean;
}

export interface ClubLoan {
  id: string;
  club_id: string;
  game_id: string;
  library_id: string;
  copy_id: string | null;
  borrower_user_id: string | null;
  guest_name: string | null;
  guest_contact: string | null;
  checked_out_by: string;
  checked_out_at: string;
  due_at: string | null;
  returned_at: string | null;
  condition_out: string | null;
  condition_in: string | null;
  notes: string | null;
  status: "checked_out" | "returned" | "overdue";
  created_at: string;
  updated_at: string;
  // Joined fields
  game?: { id: string; title: string; image_url: string | null; slug: string | null };
  library?: { id: string; name: string; slug: string };
  copy?: { id: string; copy_number: number; copy_label: string | null; condition: string | null } | null;
  borrower_profile?: { display_name: string | null; username: string | null } | null;
}

// ── Settings ──

export function useClubLendingSettings(clubId: string | null) {
  return useQuery({
    queryKey: ["club-lending-settings", clubId],
    queryFn: async () => {
      if (!clubId) return null;
      const { data, error } = await supabase
        .from("club_lending_settings")
        .select("*")
        .eq("club_id", clubId)
        .maybeSingle();
      if (error) throw error;
      return data as ClubLendingSettings | null;
    },
    enabled: !!clubId,
  });
}

export function useUpdateClubLendingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      club_id,
      ...updates
    }: Partial<ClubLendingSettings> & { club_id: string }) => {
      const { error } = await supabase
        .from("club_lending_settings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("club_id", club_id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["club-lending-settings", vars.club_id] });
    },
  });
}

// ── Loans ──

export function useClubLoans(clubId: string | null, statusFilter?: string) {
  return useQuery({
    queryKey: ["club-loans", clubId, statusFilter],
    queryFn: async () => {
      if (!clubId) return [];
      let query = supabase
        .from("club_loans")
        .select(
          "*, game:games(id, title, image_url, slug), library:libraries(id, name, slug), copy:game_copies(id, copy_number, copy_label, condition)"
        )
        .eq("club_id", clubId)
        .order("checked_out_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter as "checked_out" | "returned" | "overdue");
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      // Fetch borrower profiles for user-based loans
      const userIds = [...new Set((data || []).filter((l: any) => l.borrower_user_id).map((l: any) => l.borrower_user_id))];
      let profileMap = new Map<string, { display_name: string | null; username: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("user_id, display_name, username")
          .in("user_id", userIds);
        if (profiles) {
          profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));
        }
      }

      return (data || []).map((loan: any) => ({
        ...loan,
        borrower_profile: loan.borrower_user_id
          ? profileMap.get(loan.borrower_user_id) || null
          : null,
      })) as ClubLoan[];
    },
    enabled: !!clubId,
  });
}

// ── Realtime subscription for live sync across devices ──
export function useClubLoansRealtime(clubId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!clubId) return;

    const channel = supabase
      .channel(`club-loans-${clubId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_loans",
          filter: `club_id=eq.${clubId}`,
        },
        () => {
          // Invalidate all club loan queries to refetch
          qc.invalidateQueries({ queryKey: ["club-loans", clubId] });
          qc.invalidateQueries({ queryKey: ["club-game-search"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId, qc]);
}

export function useCheckoutGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      club_id: string;
      game_id: string;
      library_id: string;
      copy_id?: string;
      borrower_user_id?: string;
      guest_name?: string;
      guest_contact?: string;
      condition_out?: string;
      notes?: string;
      due_at?: string;
      checked_out_by: string;
    }) => {
      const { error } = await supabase.from("club_loans").insert({
        club_id: params.club_id,
        game_id: params.game_id,
        library_id: params.library_id,
        copy_id: params.copy_id || null,
        borrower_user_id: params.borrower_user_id || null,
        guest_name: params.guest_name || null,
        guest_contact: params.guest_contact || null,
        condition_out: params.condition_out || null,
        notes: params.notes || null,
        due_at: params.due_at || null,
        checked_out_by: params.checked_out_by,
        status: "checked_out",
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["club-loans", vars.club_id] });
      qc.invalidateQueries({ queryKey: ["club-game-search"] });
    },
  });
}

export function useReturnGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      loan_id: string;
      club_id: string;
      condition_in?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("club_loans")
        .update({
          status: "returned",
          returned_at: new Date().toISOString(),
          condition_in: params.condition_in || null,
          notes: params.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.loan_id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["club-loans", vars.club_id] });
      qc.invalidateQueries({ queryKey: ["club-game-search"] });
    },
  });
}

// ── Copies for a game (for club checkout copy picker) ──
export function useClubGameCopies(gameId: string | null) {
  return useQuery({
    queryKey: ["club-game-copies", gameId],
    queryFn: async () => {
      if (!gameId) return [];
      const { data, error } = await supabase
        .from("game_copies")
        .select("id, copy_number, copy_label, condition, notes")
        .eq("game_id", gameId)
        .order("copy_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!gameId,
  });
}

// ── Active loan count for a game ──
export function useGameActiveLoanCount(clubId: string | null, gameId: string | null) {
  return useQuery({
    queryKey: ["club-game-loan-count", clubId, gameId],
    queryFn: async () => {
      if (!clubId || !gameId) return 0;
      const { count, error } = await supabase
        .from("club_loans")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("game_id", gameId)
        .eq("status", "checked_out");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!clubId && !!gameId,
  });
}

// ── Check if user is a club lending staff (owner or member library owner) ──
export function useIsClubLendingStaff(clubId: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: ["club-lending-staff", clubId, userId],
    queryFn: async () => {
      if (!clubId || !userId) return false;

      // Check if user is club owner
      const { data: club } = await supabase
        .from("clubs")
        .select("owner_id")
        .eq("id", clubId)
        .maybeSingle();
      if (club?.owner_id === userId) return true;

      // Check if user owns any library that's a member of this club
      const { data: clubLibs } = await supabase
        .from("club_libraries")
        .select("library_id")
        .eq("club_id", clubId);
      if (!clubLibs || clubLibs.length === 0) return false;

      const libIds = clubLibs.map((cl: any) => cl.library_id);
      const { data: ownedLibs } = await supabase
        .from("libraries")
        .select("id")
        .in("id", libIds)
        .eq("owner_id", userId);

      return (ownedLibs && ownedLibs.length > 0) || false;
    },
    enabled: !!clubId && !!userId,
  });
}

// ── Recent borrowers for quick-fill autocomplete ──
const RECENT_BORROWERS_KEY = "club-lending-recent-borrowers";
const MAX_RECENT = 20;

export interface RecentBorrower {
  name: string;
  contact: string;
  lastUsed: number;
}

export function getRecentBorrowers(clubId: string): RecentBorrower[] {
  try {
    const raw = localStorage.getItem(`${RECENT_BORROWERS_KEY}-${clubId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentBorrower(clubId: string, name: string, contact: string) {
  try {
    const existing = getRecentBorrowers(clubId);
    // Remove existing entry with same name (case-insensitive)
    const filtered = existing.filter(
      (b) => b.name.toLowerCase() !== name.toLowerCase()
    );
    // Add to front
    filtered.unshift({ name, contact, lastUsed: Date.now() });
    // Trim to max
    const trimmed = filtered.slice(0, MAX_RECENT);
    localStorage.setItem(
      `${RECENT_BORROWERS_KEY}-${clubId}`,
      JSON.stringify(trimmed)
    );
  } catch {
    // storage full — ignore
  }
}
