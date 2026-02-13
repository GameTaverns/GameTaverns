import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSelfHostedMode, isSelfHostedSupabaseStack } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type AchievementCategory = 'collector' | 'player' | 'social' | 'explorer' | 'contributor' | 'lender';

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string | null;
  points: number;
  tier: number; // 1=Bronze, 2=Silver, 3=Gold, 4=Platinum
  requirement_type: string;
  requirement_value: number;
  is_secret: boolean;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  progress: number;
  notified: boolean;
  achievement?: Achievement;
}

export interface AchievementProgress {
  games_owned: number;
  sessions_logged: number;
  loans_completed: number;
  followers_gained: number;
  wishlist_votes: number;
  ratings_given: number;
  unique_game_types: number;
  tour_complete: number;
}

const TIER_NAMES: Record<number, string> = {
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Platinum',
};

const TIER_COLORS: Record<number, string> = {
  1: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30',
  2: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
  3: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
  4: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
};

export function useAchievements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all available achievements
  const { data: allAchievements = [], isLoading: achievementsLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("category")
        .order("tier")
        .order("requirement_value");

      if (error) throw error;
      return data as Achievement[];
    },
  });

  // Fetch user's earned achievements
  const { data: userAchievements = [], isLoading: userAchievementsLoading } = useQuery({
    queryKey: ["user-achievements", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Self-hosted Supabase stack: avoid embedded relationship syntax (causes 400 on older PostgREST)
      // Fetch user_achievements and achievements separately, then merge
      if (isSelfHostedSupabaseStack()) {
        const { data: userAchievementsData, error: uaError } = await supabase
          .from("user_achievements")
          .select("*")
          .eq("user_id", user.id)
          .order("earned_at", { ascending: false });

        if (uaError) throw uaError;
        if (!userAchievementsData || userAchievementsData.length === 0) return [];

        // Fetch related achievements
        const achievementIds = userAchievementsData.map(ua => ua.achievement_id);
        const { data: achievementsData, error: achError } = await supabase
          .from("achievements")
          .select("*")
          .in("id", achievementIds);

        if (achError) throw achError;

        // Map achievements to user achievements
        const achievementsMap = new Map((achievementsData || []).map(a => [a.id, a]));
        return userAchievementsData.map(ua => ({
          ...ua,
          achievement: achievementsMap.get(ua.achievement_id) || null,
        })) as UserAchievement[];
      }

      // Cloud mode: use embedded relationship syntax
      const { data, error } = await supabase
        .from("user_achievements")
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false });

      if (error) throw error;
      return data as UserAchievement[];
    },
    enabled: !!user,
  });

  // Calculate total points earned
  const totalPoints = userAchievements.reduce((sum, ua) => {
    return sum + (ua.achievement?.points || 0);
  }, 0);

  // Get achievements grouped by category
  const achievementsByCategory = allAchievements.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = [];
    }
    acc[achievement.category].push(achievement);
    return acc;
  }, {} as Record<AchievementCategory, Achievement[]>);

  // Check if achievement is earned
  const isEarned = (achievementId: string): boolean => {
    return userAchievements.some((ua) => ua.achievement_id === achievementId);
  };

  // Get progress for an achievement
  const getProgress = (achievementId: string): number => {
    const ua = userAchievements.find((ua) => ua.achievement_id === achievementId);
    return ua?.progress || 0;
  };

  // Get recent achievements (last 5)
  const recentAchievements = userAchievements
    .filter((ua) => ua.achievement)
    .slice(0, 5);

  // Get next achievements to earn (closest to completion)
  const getNextAchievements = (currentProgress: AchievementProgress): Achievement[] => {
    const notEarned = allAchievements.filter((a) => !isEarned(a.id) && !a.is_secret);
    
    return notEarned
      .map((achievement) => {
        const current = getCurrentValue(achievement.requirement_type, currentProgress);
        const remaining = achievement.requirement_value - current;
        return { achievement, remaining, percentComplete: (current / achievement.requirement_value) * 100 };
      })
      .filter((item) => item.remaining > 0)
      .sort((a, b) => b.percentComplete - a.percentComplete)
      .slice(0, 3)
      .map((item) => item.achievement);
  };

  return {
    allAchievements,
    userAchievements,
    totalPoints,
    achievementsByCategory,
    recentAchievements,
    isLoading: achievementsLoading || userAchievementsLoading,
    isEarned,
    getProgress,
    getNextAchievements,
    TIER_NAMES,
    TIER_COLORS,
  };
}

// Helper to get current value for a requirement type
function getCurrentValue(requirementType: string, progress: AchievementProgress): number {
  switch (requirementType) {
    case 'games_owned':
      return progress.games_owned;
    case 'sessions_logged':
      return progress.sessions_logged;
    case 'loans_completed':
      return progress.loans_completed;
    case 'followers_gained':
      return progress.followers_gained;
    case 'wishlist_votes':
      return progress.wishlist_votes;
    case 'ratings_given':
      return progress.ratings_given;
    case 'unique_game_types':
      return progress.unique_game_types;
    case 'tour_complete':
      return progress.tour_complete;
    default:
      return 0;
  }
}

// Hook to fetch another user's achievements (public view)
export function useUserAchievements(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-achievements", userId],
    queryFn: async () => {
      if (!userId) return [];

      // Self-hosted Supabase stack: avoid embedded relationship syntax
      if (isSelfHostedSupabaseStack()) {
        const { data: userAchievementsData, error: uaError } = await supabase
          .from("user_achievements")
          .select("*")
          .eq("user_id", userId)
          .order("earned_at", { ascending: false });

        if (uaError) throw uaError;
        if (!userAchievementsData || userAchievementsData.length === 0) return [];

        // Fetch related achievements
        const achievementIds = userAchievementsData.map(ua => ua.achievement_id);
        const { data: achievementsData, error: achError } = await supabase
          .from("achievements")
          .select("*")
          .in("id", achievementIds);

        if (achError) throw achError;

        const achievementsMap = new Map((achievementsData || []).map(a => [a.id, a]));
        return userAchievementsData.map(ua => ({
          ...ua,
          achievement: achievementsMap.get(ua.achievement_id) || null,
        })) as UserAchievement[];
      }

      // Cloud mode: use embedded relationship syntax
      const { data, error } = await supabase
        .from("user_achievements")
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq("user_id", userId)
        .order("earned_at", { ascending: false });

      if (error) throw error;
      return data as UserAchievement[];
    },
    enabled: !!userId,
  });
}
