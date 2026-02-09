import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";

export type FeedbackType = "feedback" | "bug" | "feature_request";

export interface PlatformFeedback {
  id: string;
  type: FeedbackType;
  sender_name: string;
  sender_email: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function usePlatformFeedback() {
  return useQuery({
    queryKey: ["platform-feedback"],
    queryFn: async (): Promise<PlatformFeedback[]> => {
      const { data, error } = await supabase
        .from("platform_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as PlatformFeedback[];
    },
  });
}

export function useUnreadFeedbackCount() {
  return useQuery({
    queryKey: ["platform-feedback", "unread-count"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("platform_feedback")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);

      if (error) throw error;
      return count || 0;
    },
  });
}

export function useMarkFeedbackRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("platform_feedback")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-feedback"] });
    },
  });
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("platform_feedback")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-feedback"] });
    },
  });
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: async (feedback: {
      type: FeedbackType;
      sender_name: string;
      sender_email: string;
      message: string;
    }) => {
      // Save to database
      const { error } = await supabase
        .from("platform_feedback")
        .insert(feedback);

      if (error) throw error;

      // Fire-and-forget: notify admins via Discord DM + email
      supabase.functions.invoke("notify-feedback", {
        body: feedback,
      }).catch((e) => console.warn("Feedback notification failed:", e));
    },
  });
}
