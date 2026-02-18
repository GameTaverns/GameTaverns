import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export interface DiscoverUser {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  games_owned: number;
  sessions_logged: number;
}

// Search users by username/display_name
export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ["user-search", query],
    queryFn: async (): Promise<DiscoverUser[]> => {
      if (!query || query.length < 2) return [];
      const { data, error } = await (supabase as any)
        .from("public_user_profiles")
        .select("user_id, username, display_name, avatar_url, games_owned, sessions_logged")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: query.length >= 2,
  });
}

// Suggested users: followers of people you follow who you don't yet follow
export function useSuggestedUsers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["suggested-users", user?.id],
    queryFn: async (): Promise<DiscoverUser[]> => {
      if (!user) return [];

      // Get who you follow
      const { data: myFollows } = await (supabase as any)
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const followedIds: string[] = (myFollows || []).map((f: any) => f.following_id);
      if (followedIds.length === 0) {
        // Fallback: most active users
        const { data } = await (supabase as any)
          .from("public_user_profiles")
          .select("user_id, username, display_name, avatar_url, games_owned, sessions_logged")
          .neq("user_id", user.id)
          .order("sessions_logged", { ascending: false })
          .limit(6);
        return (data || []).filter((u: any) => u.username);
      }

      // Get followers of people you follow
      const { data: secondDegree } = await (supabase as any)
        .from("user_follows")
        .select("following_id")
        .in("follower_id", followedIds)
        .neq("following_id", user.id)
        .not("following_id", "in", `(${followedIds.join(",")})`)
        .limit(30);

      if (!secondDegree || secondDegree.length === 0) {
        const { data } = await (supabase as any)
          .from("public_user_profiles")
          .select("user_id, username, display_name, avatar_url, games_owned, sessions_logged")
          .neq("user_id", user.id)
          .not("user_id", "in", `(${followedIds.join(",")})`)
          .order("sessions_logged", { ascending: false })
          .limit(6);
        return (data || []).filter((u: any) => u.username);
      }

      // Deduplicate and get profiles
      const candidateIds = [...new Set(secondDegree.map((f: any) => f.following_id))].slice(0, 10);
      const { data: profiles } = await (supabase as any)
        .from("public_user_profiles")
        .select("user_id, username, display_name, avatar_url, games_owned, sessions_logged")
        .in("user_id", candidateIds);

      return (profiles || []).filter((u: any) => u.username);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

// Follow counts for a user
export function useFollowCounts(userId: string | undefined) {
  return useQuery({
    queryKey: ["follow-counts", userId],
    queryFn: async () => {
      if (!userId) return { followers: 0, following: 0 };
      const [{ count: followers }, { count: following }] = await Promise.all([
        (supabase as any)
          .from("user_follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", userId),
        (supabase as any)
          .from("user_follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", userId),
      ]);
      return { followers: followers ?? 0, following: following ?? 0 };
    },
    enabled: !!userId,
  });
}
