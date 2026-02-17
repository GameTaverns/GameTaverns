import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface PublicProfile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  featured_achievement_id: string | null;
  member_since: string;
  games_owned: number;
  expansions_owned: number;
  sessions_logged: number;
  achievements_earned: number;
  achievement_points: number;
}

export interface PublicProfileCommunity {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function usePublicProfile(username: string | undefined) {
  return useQuery({
    queryKey: ["public-profile", username],
    queryFn: async (): Promise<PublicProfile | null> => {
      if (!username) return null;

      const { data, error } = await (supabase as any)
        .from("public_user_profiles")
        .select("*")
        .ilike("username", username)
        .maybeSingle();

      if (error) throw error;
      return data as PublicProfile | null;
    },
    enabled: !!username,
  });
}

export function usePublicProfileCommunities(userId: string | undefined) {
  return useQuery({
    queryKey: ["public-profile-communities", userId],
    queryFn: async (): Promise<PublicProfileCommunity[]> => {
      if (!userId) return [];

      // Get libraries the user owns
      const { data: ownedLibs } = await supabase
        .from("libraries")
        .select("id, name, slug")
        .eq("owner_id", userId)
        .eq("is_active", true);

      // Get libraries the user is a member of
      const { data: memberships } = await supabase
        .from("library_members")
        .select("library_id, role")
        .eq("user_id", userId);

      const communities: PublicProfileCommunity[] = [];

      if (ownedLibs) {
        for (const lib of ownedLibs) {
          communities.push({ id: lib.id, name: lib.name, slug: lib.slug, role: "owner" });
        }
      }

      if (memberships && memberships.length > 0) {
        const libIds = memberships
          .map((m) => m.library_id)
          .filter((id) => !communities.some((c) => c.id === id));

        if (libIds.length > 0) {
          const { data: libs } = await supabase
            .from("libraries")
            .select("id, name, slug")
            .in("id", libIds)
            .eq("is_active", true);

          if (libs) {
            for (const lib of libs) {
              const membership = memberships.find((m) => m.library_id === lib.id);
              communities.push({
                id: lib.id,
                name: lib.name,
                slug: lib.slug,
                role: membership?.role || "member",
              });
            }
          }
        }
      }

      return communities;
    },
    enabled: !!userId,
  });
}

export function usePublicProfileAchievements(userId: string | undefined) {
  return useQuery({
    queryKey: ["public-profile-achievements", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data: userAchievements, error: uaError } = await supabase
        .from("user_achievements")
        .select("*")
        .eq("user_id", userId)
        .order("earned_at", { ascending: false })
        .limit(12);

      if (uaError) throw uaError;
      if (!userAchievements || userAchievements.length === 0) return [];

      const achievementIds = userAchievements.map((ua: any) => ua.achievement_id);
      const { data: achievements } = await supabase
        .from("achievements")
        .select("*")
        .in("id", achievementIds);

      const achievementMap = new Map((achievements || []).map((a: any) => [a.id, a]));

      return userAchievements.map((ua: any) => ({
        ...ua,
        achievement: achievementMap.get(ua.achievement_id) || null,
      }));
    },
    enabled: !!userId,
  });
}

export function useFollowCounts(userId: string | undefined) {
  return useQuery({
    queryKey: ["follow-counts", userId],
    queryFn: async () => {
      if (!userId) return { followers: 0, following: 0 };

      const [followersResult, followingResult] = await Promise.all([
        (supabase as any)
          .from("user_follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", userId),
        (supabase as any)
          .from("user_follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", userId),
      ]);

      return {
        followers: followersResult.count || 0,
        following: followingResult.count || 0,
      };
    },
    enabled: !!userId,
  });
}
