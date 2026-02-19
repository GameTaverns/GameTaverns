import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SpecialBadge {
  id: string;
  user_id: string;
  badge_type: string;
  badge_label: string;
  badge_color: string;
  badge_icon: string | null;
  granted_by: string;
  granted_at: string;
  notes: string | null;
}

/** Fetch special badges for a specific user */
export function useUserSpecialBadges(userId?: string | null) {
  return useQuery({
    queryKey: ["special-badges", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("user_special_badges")
        .select("*")
        .eq("user_id", userId)
        .order("granted_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecialBadge[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Admin: fetch all special badges across all users */
export function useAllSpecialBadges() {
  return useQuery({
    queryKey: ["special-badges-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_special_badges")
        .select("*, user_profiles(display_name, username, avatar_url)")
        .order("granted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (SpecialBadge & { user_profiles: { display_name: string | null; username: string | null; avatar_url: string | null } | null })[];
    },
    staleTime: 60 * 1000,
  });
}

/** Admin: grant a special badge to a user */
export function useGrantSpecialBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (badge: Omit<SpecialBadge, "id" | "granted_at">) => {
      const { data, error } = await (supabase as any)
        .from("user_special_badges")
        .upsert(badge, { onConflict: "user_id,badge_type" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["special-badges"] });
      qc.invalidateQueries({ queryKey: ["special-badges-all"] });
      toast.success("Special badge granted!");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to grant badge"),
  });
}

/** Admin: revoke a special badge */
export function useRevokeSpecialBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("user_special_badges")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["special-badges"] });
      qc.invalidateQueries({ queryKey: ["special-badges-all"] });
      toast.success("Badge revoked.");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to revoke badge"),
  });
}

/** Predefined badge types admins can choose from */
export const SPECIAL_BADGE_PRESETS = [
  { badge_type: "designer", badge_label: "Game Designer", badge_color: "#7c3aed", badge_icon: "Pencil" },
  { badge_type: "artist", badge_label: "Board Game Artist", badge_color: "#db2777", badge_icon: "Palette" },
  { badge_type: "influencer", badge_label: "Content Creator", badge_color: "#ea580c", badge_icon: "Video" },
  { badge_type: "publisher", badge_label: "Publisher", badge_color: "#0891b2", badge_icon: "BookOpen" },
  { badge_type: "reviewer", badge_label: "Reviewer", badge_color: "#16a34a", badge_icon: "Star" },
  { badge_type: "developer", badge_label: "Game Developer", badge_color: "#dc2626", badge_icon: "Code" },
  { badge_type: "verified", badge_label: "Verified", badge_color: "#2563eb", badge_icon: "BadgeCheck" },
];
