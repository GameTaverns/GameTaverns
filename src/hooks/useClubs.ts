import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "./useAuth";

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  owner_id: string;
  status: string;
  is_public: boolean;
  is_active: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  owner_name?: string;
}

export interface ClubLibrary {
  id: string;
  club_id: string;
  library_id: string;
  joined_at: string;
  library?: { id: string; name: string; slug: string; owner_id: string };
}

export interface ClubInviteCode {
  id: string;
  club_id: string;
  code: string;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ClubEvent {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_location: string | null;
  created_by: string;
  created_at: string;
}

export interface ClubGame {
  id: string;
  title: string;
  image_url: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time: string | null;
  library_id: string;
  bgg_id: string | null;
  copies_owned: number;
  library_name: string;
  library_slug: string;
  owner_name: string;
}

// ── Invoke the clubs edge function ──
async function invokeClubs(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("clubs", {
    method: "POST",
    body,
  });
  if (error) throw error;
  const payload: any = data;
  if (payload?.error) throw new Error(payload.error);
  return payload;
}

// ── My Clubs (owned + member of) ──
export function useMyClubs() {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["my-clubs", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get clubs user owns
      const { data: owned } = await supabase
        .from("clubs")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at");

      // Get clubs via library membership
      const { data: myLibs } = await supabase
        .from("libraries")
        .select("id")
        .eq("owner_id", user.id);

      const libIds = (myLibs || []).map((l: any) => l.id);
      let memberClubIds: string[] = [];

      if (libIds.length > 0) {
        const { data: memberships } = await supabase
          .from("club_libraries")
          .select("club_id")
          .in("library_id", libIds);
        memberClubIds = (memberships || []).map((m: any) => m.club_id);
      }

      // Fetch member clubs not already owned
      const ownedIds = new Set((owned || []).map((c: any) => c.id));
      const uniqueMemberIds = memberClubIds.filter((id) => !ownedIds.has(id));

      let memberClubs: any[] = [];
      if (uniqueMemberIds.length > 0) {
        const { data } = await supabase
          .from("clubs")
          .select("*")
          .in("id", uniqueMemberIds);
        memberClubs = data || [];
      }

      return [...(owned || []), ...memberClubs] as Club[];
    },
    enabled: isAuthenticated && !!user,
  });
}

// ── Single Club ──
export function useClub(slugOrId: string | null) {
  return useQuery({
    queryKey: ["club", slugOrId],
    queryFn: async () => {
      if (!slugOrId) return null;

      // Try by slug first, then by id
      let query = supabase.from("clubs").select("*");
      if (slugOrId.includes("-") && slugOrId.length < 40) {
        query = query.eq("slug", slugOrId);
      } else {
        query = query.eq("id", slugOrId);
      }

      const { data } = await query.maybeSingle();
      if (data) return data as Club;

      // Fallback: try the other field
      const { data: fallback } = await supabase
        .from("clubs")
        .select("*")
        .eq("slug", slugOrId)
        .maybeSingle();
      return (fallback as Club) || null;
    },
    enabled: !!slugOrId,
  });
}

// ── Club Libraries ──
export function useClubLibraries(clubId: string | null) {
  return useQuery({
    queryKey: ["club-libraries", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("club_libraries")
        .select("*, library:libraries(id, name, slug, owner_id)")
        .eq("club_id", clubId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!clubId,
  });
}

// ── Club Invite Codes ──
export function useClubInviteCodes(clubId: string | null) {
  return useQuery({
    queryKey: ["club-invite-codes", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("club_invite_codes")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ClubInviteCode[];
    },
    enabled: !!clubId,
  });
}

// ── Club Events ──
export function useClubEvents(clubId: string | null) {
  return useQuery({
    queryKey: ["club-events", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("club_events")
        .select("*")
        .eq("club_id", clubId)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return (data || []) as ClubEvent[];
    },
    enabled: !!clubId,
  });
}

// ── Public Clubs Directory ──
export function usePublicClubs() {
  return useQuery({
    queryKey: ["public-clubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("*")
        .eq("status", "approved")
        .eq("is_public", true)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Club[];
    },
  });
}

// ── Pending Clubs (admin) ──
export function usePendingClubs() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["pending-clubs"],
    queryFn: async () => {
      const result = await invokeClubs({ action: "list_pending" });
      return (result || []) as Club[];
    },
    enabled: isAdmin,
  });
}

// ── Mutations ──
export function useRequestClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      name: string;
      slug: string;
      description?: string;
      is_public?: boolean;
    }) => invokeClubs({ action: "request_club", ...params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-clubs"] });
    },
  });
}

export function useApproveClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (club_id: string) =>
      invokeClubs({ action: "approve_club", club_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-clubs"] });
      qc.invalidateQueries({ queryKey: ["public-clubs"] });
    },
  });
}

export function useRejectClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (club_id: string) =>
      invokeClubs({ action: "reject_club", club_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-clubs"] });
    },
  });
}

export function useGenerateInviteCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      club_id: string;
      max_uses?: number;
      expires_in_days?: number;
    }) => invokeClubs({ action: "generate_invite_code", ...params }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["club-invite-codes", vars.club_id] });
    },
  });
}

export function useRedeemInviteCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { code: string; library_id: string }) =>
      invokeClubs({ action: "redeem_invite_code", ...params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-clubs"] });
    },
  });
}

export function useRemoveClubLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { club_id: string; library_id: string }) =>
      invokeClubs({ action: "remove_library", ...params }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["club-libraries", vars.club_id] });
    },
  });
}

export function useUpdateClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      club_id: string;
      name?: string;
      description?: string;
      is_public?: boolean;
      logo_url?: string;
    }) => invokeClubs({ action: "update_club", ...params }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["club", vars.club_id] });
      qc.invalidateQueries({ queryKey: ["my-clubs"] });
    },
  });
}

export function useClubGameSearch(clubId: string | null, query: string) {
  return useQuery({
    queryKey: ["club-game-search", clubId, query],
    queryFn: async () => {
      if (!clubId) return [];
      const result = await invokeClubs({
        action: "search_games",
        club_id: clubId,
        query: query || undefined,
      });
      return (result?.games || []) as ClubGame[];
    },
    enabled: !!clubId,
  });
}

export function useCreateClubEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      club_id: string;
      title: string;
      description?: string;
      event_date: string;
      event_location?: string;
    }) => invokeClubs({ action: "create_event", ...params }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["club-events", vars.club_id] });
    },
  });
}

export function useDeleteClubEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { event_id: string; club_id: string }) =>
      invokeClubs({ action: "delete_event", event_id: params.event_id }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["club-events", vars.club_id] });
    },
  });
}

export function useDeleteClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (club_id: string) =>
      invokeClubs({ action: "delete_club", club_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-clubs"] });
      qc.invalidateQueries({ queryKey: ["public-clubs"] });
    },
  });
}
