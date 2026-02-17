import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export function useIsFollowing(currentUserId: string | undefined, targetUserId: string | undefined) {
  return useQuery({
    queryKey: ["is-following", currentUserId, targetUserId],
    queryFn: async () => {
      if (!currentUserId || !targetUserId || currentUserId === targetUserId) return false;
      const { data } = await (supabase as any)
        .from("user_follows")
        .select("id")
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentUserId && !!targetUserId && currentUserId !== targetUserId,
  });
}

export function useToggleFollow(currentUserId: string | undefined, targetUserId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (isCurrentlyFollowing: boolean) => {
      if (!currentUserId || !targetUserId) throw new Error("Missing user IDs");

      if (isCurrentlyFollowing) {
        const { error } = await (supabase as any)
          .from("user_follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", targetUserId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("user_follows")
          .insert({ follower_id: currentUserId, following_id: targetUserId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following", currentUserId, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["follow-counts", targetUserId] });
    },
  });
}
