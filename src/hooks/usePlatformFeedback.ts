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
      screenshots?: File[];
    }) => {
      // Upload screenshots first
      const screenshotUrls: string[] = [];
      if (feedback.screenshots?.length) {
        for (const file of feedback.screenshots) {
          const ext = file.name.split(".").pop() || "png";
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("feedback-attachments")
            .upload(path, file, { contentType: file.type });
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from("feedback-attachments")
              .getPublicUrl(path);
            screenshotUrls.push(urlData.publicUrl);
          }
        }
      }

      // Save to database
      const { error } = await supabase
        .from("platform_feedback")
        .insert({
          type: feedback.type,
          sender_name: feedback.sender_name,
          sender_email: feedback.sender_email,
          message: feedback.message,
        });

      if (error) throw error;

      // Fire-and-forget: notify admins via Discord + email
      supabase.functions.invoke("notify-feedback", {
        body: {
          type: feedback.type,
          sender_name: feedback.sender_name,
          sender_email: feedback.sender_email,
          message: feedback.message,
          screenshot_urls: screenshotUrls,
        },
      }).catch((e) => console.warn("Feedback notification failed:", e));
    },
  });
}
