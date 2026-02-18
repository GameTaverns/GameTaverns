import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export function useActivityReactions(eventId: string) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["activity-reactions", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("activity_reactions")
        .select("id, user_id, reaction_type")
        .eq("event_id", eventId);
      if (error) throw error;
      return data || [];
    },
  });

  const likeCount = (data || []).filter((r: any) => r.reaction_type === "like").length;
  const hasLiked = !!(data || []).find((r: any) => r.user_id === user?.id && r.reaction_type === "like");

  return { likeCount, hasLiked, isLoading };
}

export function useToggleReaction(eventId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (hasLiked: boolean) => {
      if (!user) throw new Error("Not authenticated");
      if (hasLiked) {
        const { error } = await (supabase as any)
          .from("activity_reactions")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .eq("reaction_type", "like");
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("activity_reactions")
          .insert({ event_id: eventId, user_id: user.id, reaction_type: "like" });
        if (error) throw error;
      }
    },
    // Optimistic update
    onMutate: async (hasLiked) => {
      await queryClient.cancelQueries({ queryKey: ["activity-reactions", eventId] });
      const previous = queryClient.getQueryData(["activity-reactions", eventId]);
      queryClient.setQueryData(["activity-reactions", eventId], (old: any[] = []) => {
        if (hasLiked) {
          return old.filter((r) => !(r.user_id === user?.id && r.reaction_type === "like"));
        } else {
          return [...old, { id: "optimistic", user_id: user?.id, reaction_type: "like" }];
        }
      });
      return { previous };
    },
    onError: (_, __, context: any) => {
      queryClient.setQueryData(["activity-reactions", eventId], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-reactions", eventId] });
    },
  });
}
