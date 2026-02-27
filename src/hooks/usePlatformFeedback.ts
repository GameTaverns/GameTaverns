import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";

export type FeedbackType = "feedback" | "bug" | "feature_request";
export type FeedbackStatus = "open" | "in_progress" | "resolved" | "wont_fix";

export interface PlatformFeedback {
  id: string;
  type: FeedbackType;
  sender_name: string;
  sender_email: string;
  message: string;
  is_read: boolean;
  status: FeedbackStatus;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackNote {
  id: string;
  feedback_id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  note_type: "internal" | "reply";
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

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FeedbackStatus }) => {
      const { error } = await supabase
        .from("platform_feedback")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-feedback"] });
    },
  });
}

export function useAssignFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, assignedTo, assignedToName }: { id: string; assignedTo: string | null; assignedToName: string | null }) => {
      const { error } = await supabase
        .from("platform_feedback")
        .update({ assigned_to: assignedTo, assigned_to_name: assignedToName, updated_at: new Date().toISOString() })
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

// Feedback Notes
export function useFeedbackNotes(feedbackId: string | undefined) {
  return useQuery({
    queryKey: ["feedback-notes", feedbackId],
    queryFn: async (): Promise<FeedbackNote[]> => {
      if (!feedbackId) return [];
      const { data, error } = await supabase
        .from("feedback_notes")
        .select("*")
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as FeedbackNote[];
    },
    enabled: !!feedbackId,
  });
}

export function useAddFeedbackNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { feedback_id: string; author_id: string; author_name: string; content: string; note_type: "internal" | "reply" }) => {
      const { data, error } = await supabase
        .from("feedback_notes")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["feedback-notes", data.feedback_id] });
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
          const path = `feedback/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("feedback-attachments")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (uploadError) {
            console.error("Screenshot upload failed:", uploadError.message);
          } else {
            const { data: urlData } = supabase.storage
              .from("feedback-attachments")
              .getPublicUrl(path);
            if (urlData?.publicUrl) {
              screenshotUrls.push(urlData.publicUrl);
            }
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
