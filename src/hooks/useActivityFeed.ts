import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface ActivityEvent {
  id: string;
  user_id: string;
  event_type: string;
  metadata: Record<string, any>;
  created_at: string;
  // Joined data
  user_display_name?: string;
  user_avatar_url?: string;
  user_username?: string;
}

export function useFollowingFeed(currentUserId: string | undefined, limit = 30) {
  return useQuery({
    queryKey: ["following-feed", currentUserId, limit],
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!currentUserId) return [];

      // Get who the user follows
      const { data: follows } = await (supabase as any)
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      if (!follows || follows.length === 0) return [];

      const followedIds = follows.map((f: any) => f.following_id);

      // Get activity from followed users
      const { data: events, error } = await (supabase as any)
        .from("activity_events")
        .select("*")
        .in("user_id", followedIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!events || events.length === 0) return [];

      // Enrich with user profiles
      const userIds = [...new Set(events.map((e: any) => e.user_id))];
      const { data: profiles } = await (supabase as any)
        .from("public_user_profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      return events.map((e: any) => {
        const profile = profileMap.get(e.user_id) as any;
        return {
          ...e,
          user_display_name: profile?.display_name || profile?.username || "Unknown",
          user_avatar_url: profile?.avatar_url,
          user_username: profile?.username,
        };
      });
    },
    enabled: !!currentUserId,
  });
}

export function usePlatformFeed(limit = 30) {
  return useQuery({
    queryKey: ["platform-feed", limit],
    queryFn: async (): Promise<ActivityEvent[]> => {
      const { data: events, error } = await (supabase as any)
        .from("activity_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!events || events.length === 0) return [];

      const userIds = [...new Set(events.map((e: any) => e.user_id))];
      const { data: profiles } = await (supabase as any)
        .from("public_user_profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      return events.map((e: any) => {
        const profile = profileMap.get(e.user_id) as any;
        return {
          ...e,
          user_display_name: profile?.display_name || profile?.username || "Unknown",
          user_avatar_url: profile?.avatar_url,
          user_username: profile?.username,
        };
      });
    },
  });
}
