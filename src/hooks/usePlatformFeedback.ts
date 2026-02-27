import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { getSupabaseConfig, isSelfHostedSupabaseStack } from "@/config/runtime";

async function invokeBackendFunction(functionName: string, body: Record<string, unknown>) {
  try {
    // Self-hosted consolidated runtime: route through main/<function>
    if (isSelfHostedSupabaseStack()) {
      const { url, anonKey } = getSupabaseConfig();
      if (url && anonKey) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        const response = await fetch(`${url}/functions/v1/main/${functionName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(body),
        });

        const raw = await response.text();
        const parsed = raw ? (() => {
          try { return JSON.parse(raw); } catch { return raw; }
        })() : null;

        if (!response.ok) {
          const errMessage = typeof parsed === "object" && parsed && "error" in (parsed as Record<string, unknown>)
            ? String((parsed as Record<string, unknown>).error)
            : raw || `HTTP ${response.status}`;
          console.warn(`[Feedback] ${functionName} self-hosted invoke failed:`, response.status, errMessage);
          return { ok: false, data: parsed, error: errMessage };
        }

        return { ok: true, data: parsed, error: null };
      }
    }

    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) {
      console.warn(`[Feedback] ${functionName} invoke failed:`, error.message || error);
      return { ok: false, data: null, error: error.message || String(error) };
    }
    return { ok: true, data, error: null };
  } catch (error) {
    console.warn(`[Feedback] ${functionName} invoke threw:`, error);
    return { ok: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}
export type FeedbackType = "feedback" | "bug" | "feature_request";
export type FeedbackStatus = "open" | "in_progress" | "resolved" | "closed" | "wont_fix";

export interface PlatformFeedback {
  id: string;
  type: FeedbackType;
  sender_name: string;
  sender_email: string;
  message: string;
  screenshot_urls: string[];
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

function extractNotifyThreadId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const results = (payload as Record<string, unknown>).results;
  if (!results || typeof results !== "object") return null;
  const discord = (results as Record<string, unknown>).discord;
  if (!discord || typeof discord !== "object") return null;
  const threadId = (discord as Record<string, unknown>).thread_id;
  return typeof threadId === "string" && threadId.length > 0 ? threadId : null;
}

async function ensureDiscordThreadId(feedbackId: string): Promise<string | null> {
  const { data: feedback, error } = await supabase
    .from("platform_feedback")
    .select("id,type,sender_name,sender_email,message,screenshot_urls,discord_thread_id")
    .eq("id", feedbackId)
    .maybeSingle();

  if (error || !feedback) return null;
  if (feedback.discord_thread_id) return feedback.discord_thread_id;

  const notifyResult = await invokeBackendFunction("notify-feedback", {
    type: feedback.type,
    sender_name: feedback.sender_name,
    sender_email: feedback.sender_email,
    message: feedback.message,
    screenshot_urls: Array.isArray(feedback.screenshot_urls) ? feedback.screenshot_urls : [],
    feedback_id: feedback.id,
  });

  if (!notifyResult.ok) return null;

  // Prefer direct function response to avoid hard dependency on immediate DB persistence
  const threadIdFromNotify = extractNotifyThreadId(notifyResult.data);
  if (threadIdFromNotify) return threadIdFromNotify;

  const { data: refreshed } = await supabase
    .from("platform_feedback")
    .select("discord_thread_id")
    .eq("id", feedbackId)
    .maybeSingle();

  return refreshed?.discord_thread_id ?? null;
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

      // Close the Discord thread when resolved or closed
      if (status === "resolved" || status === "closed") {
        const threadId = await ensureDiscordThreadId(id);
        if (threadId) {
          await invokeBackendFunction("discord-lock-thread", {
            thread_id: threadId,
          });
        } else {
          console.warn("[Feedback] Could not resolve discord_thread_id for", id);
        }
      }
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

      // Post note to Discord thread (auto-create thread if one doesn't exist yet)
      const threadId = await ensureDiscordThreadId(input.feedback_id);

      if (threadId) {
        await invokeBackendFunction("discord-lock-thread", {
          action: "post_note",
          thread_id: threadId,
          author_name: input.author_name,
          content: input.content,
          note_type: input.note_type,
        });
      } else {
        console.warn("[Feedback] Could not resolve discord_thread_id for note on", input.feedback_id);
      }

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
            throw new Error(`Failed to upload screenshot "${file.name}": ${uploadError.message}`);
          }

          const { data: urlData } = supabase.storage
            .from("feedback-attachments")
            .getPublicUrl(path);

          if (!urlData?.publicUrl) {
            throw new Error(`Failed to resolve public URL for screenshot "${file.name}"`);
          }

          screenshotUrls.push(urlData.publicUrl);
        }
      }

      // Save to database
      const { data: inserted, error } = await supabase
        .from("platform_feedback")
        .insert({
          type: feedback.type,
          sender_name: feedback.sender_name,
          sender_email: feedback.sender_email,
          message: feedback.message,
          screenshot_urls: screenshotUrls.length > 0 ? screenshotUrls : [],
        })
        .select("id")
        .single();

      if (error) throw error;

      // Fire-and-forget: notify admins via Discord + email (pass feedback_id so thread ID is saved back)
      void invokeBackendFunction("notify-feedback", {
        type: feedback.type,
        sender_name: feedback.sender_name,
        sender_email: feedback.sender_email,
        message: feedback.message,
        screenshot_urls: screenshotUrls,
        feedback_id: inserted?.id,
      });
    },
  });
}
