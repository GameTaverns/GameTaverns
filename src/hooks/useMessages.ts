import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface GameMessage {
  id: string;
  game_id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  is_read: boolean;
  created_at: string;
  game?: {
    title: string;
    slug: string | null;
  } | null;
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
      
      // Get game IDs for this library first
      const { data: games, error: gamesError } = await supabase
        .from("games")
        .select("id")
        .eq("library_id", libraryId);
      
      if (gamesError) throw gamesError;
      if (!games || games.length === 0) return 0;
      
      const gameIds = games.map(g => g.id);
      
      const { count, error } = await supabase
        .from("game_messages")
        .select("*", { count: "exact", head: true })
        .in("game_id", gameIds)
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
