import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ReferralBadge {
  user_id: string;
  referral_count: number;
  has_tavern_regular: boolean;
  has_town_crier: boolean;
  has_guild_founder: boolean;
  has_legend: boolean;
  is_founding_member: boolean;
  founding_member_granted_at: string | null;
}

export interface ReferralEntry {
  id: string;
  referral_code: string;
  referred_user_id: string | null;
  signed_up_at: string | null;
  created_at: string;
}

export const REFERRAL_TIERS = [
  {
    key: "has_tavern_regular" as const,
    label: "Tavern Regular",
    emoji: "🍺",
    description: "Referred 1 person to GameTaverns",
    threshold: 1,
    color: "bg-amber-100 text-amber-800 border-amber-300",
  },
  {
    key: "has_town_crier" as const,
    label: "Town Crier",
    emoji: "📣",
    description: "Referred 5 people to GameTaverns",
    threshold: 5,
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
  {
    key: "has_guild_founder" as const,
    label: "Guild Founder",
    emoji: "⚔️",
    description: "Referred 15 people to GameTaverns",
    threshold: 15,
    color: "bg-purple-100 text-purple-800 border-purple-300",
  },
  {
    key: "has_legend" as const,
    label: "Legend",
    emoji: "👑",
    description: "Referred 50 people — a true GameTaverns Legend",
    threshold: 50,
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
];

export const FOUNDING_MEMBER_BADGE = {
  key: "is_founding_member" as const,
  label: "Founding Member",
  emoji: "🏛️",
  description: "Early supporter of GameTaverns — available until September 1, 2026",
  color: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

/** Hook for the current user's referral data */
export function useMyReferral() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch existing referrals (both confirmed and pending)
  const { data: referrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ["my-referrals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ReferralEntry[];
    },
    enabled: !!user,
  });

  // Fetch my badge row
  const { data: badges, isLoading: badgesLoading } = useQuery({
    queryKey: ["my-referral-badges", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("referral_badges")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as ReferralBadge | null;
    },
    enabled: !!user,
  });

  // Get or generate the user's referral code
  const generateCode = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("get_or_create_referral_code", {
        _user_id: user.id,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-referrals", user?.id] });
    },
    onError: (e) => toast.error("Failed to generate referral code: " + e.message),
  });

  // Get the active referral code (most recent pending one)
  const activeCode = referrals.find((r) => !r.referred_user_id)?.referral_code;

  // Build the full shareable URL
  const referralUrl = activeCode
    ? `${window.location.origin}/signup?ref=${activeCode}`
    : null;

  const confirmedCount = badges?.referral_count ?? referrals.filter((r) => r.referred_user_id).length;

  // Next tier info
  const nextTier = REFERRAL_TIERS.find((t) => confirmedCount < t.threshold);
  const progressToNext = nextTier
    ? Math.min((confirmedCount / nextTier.threshold) * 100, 100)
    : 100;

  return {
    referrals,
    badges,
    activeCode,
    referralUrl,
    confirmedCount,
    nextTier,
    progressToNext,
    isLoading: referralsLoading || badgesLoading,
    generateCode,
  };
}

/** Hook to fetch any user's badges (for profile display) */
export function useUserReferralBadges(userId: string | undefined) {
  return useQuery({
    queryKey: ["referral-badges", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("referral_badges")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as ReferralBadge | null;
    },
    enabled: !!userId,
  });
}
