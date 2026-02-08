import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface GameMessageReply {
  id: string;
  reply_text: string;
  replied_by: string;
  is_owner_reply: boolean;
  created_at: string;
}

export interface GameMessage {
  id: string;
  game_id: string;
  sender_name: string;
  sender_email: string;
  sender_user_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  game?: {
    title: string;
    slug: string | null;
  } | null;
  replies?: GameMessageReply[];
}

export function useMessages(libraryId?: string) {
  return useQuery({
    queryKey: ["messages", libraryId],
    queryFn: async (): Promise<GameMessage[]> => {
      // Use the decrypt-messages edge function to get decrypted PII
      // Pass library_id as query param if provided
      const params = libraryId ? { library_id: libraryId } : {};
      const { data, error } = await supabase.functions.invoke("decrypt-messages", {
        body: params,
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || "Failed to fetch messages");
      }

      return data.messages || [];
    },
  });
}

export function useUnreadMessageCount(libraryId?: string) {
  return useQuery({
    queryKey: ["messages", "unread-count", libraryId],
    queryFn: async (): Promise<number> => {
      if (!libraryId) return 0;
      
      // Use join filtering to avoid long URL with game IDs
      const { count, error } = await supabase
        .from("game_messages")
        .select("*, games!inner(library_id)", { count: "exact", head: true })
        .eq("games.library_id", libraryId)
        .eq("is_read", false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!libraryId,
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("game_messages")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("game_messages")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}
