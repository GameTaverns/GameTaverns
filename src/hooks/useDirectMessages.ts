import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  deleted_by_sender: boolean;
  deleted_by_recipient: boolean;
  created_at: string;
}

export interface DMConversation {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

// List all conversations for the current user
export function useDMConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["dm-conversations", user?.id],
    queryFn: async (): Promise<DMConversation[]> => {
      if (!user) return [];

      const { data: msgs, error } = await (supabase as any)
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!msgs || msgs.length === 0) return [];

      // Group by conversation partner
      const convMap = new Map<string, { lastMsg: DirectMessage; unread: number }>();
      for (const m of msgs as DirectMessage[]) {
        const partnerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        const isDeleted =
          (m.sender_id === user.id && m.deleted_by_sender) ||
          (m.recipient_id === user.id && m.deleted_by_recipient);
        if (isDeleted) continue;

        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, { lastMsg: m, unread: 0 });
        }
        // Count unread (received, not read)
        if (m.recipient_id === user.id && !m.read_at) {
          convMap.get(partnerId)!.unread++;
        }
      }

      if (convMap.size === 0) return [];

      const partnerIds = [...convMap.keys()];
      const { data: profiles } = await (supabase as any)
        .from("public_user_profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", partnerIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      return partnerIds
        .map((pid) => {
          const { lastMsg, unread } = convMap.get(pid)!;
          const profile = profileMap.get(pid) as any;
          return {
            user_id: pid,
            display_name: profile?.display_name || profile?.username || "Unknown",
            username: profile?.username || null,
            avatar_url: profile?.avatar_url || null,
            last_message: lastMsg.content,
            last_message_at: lastMsg.created_at,
            unread_count: unread,
          };
        })
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel(`dm-conversations-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "direct_messages",
        filter: `recipient_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["dm-conversations", user.id] });
        queryClient.invalidateQueries({ queryKey: ["dm-unread-count", user.id] });
      })
      .subscribe();
    return () => (supabase as any).removeChannel(channel);
  }, [user, queryClient]);

  return query;
}

// Get messages in a conversation with a specific user
export function useDMThread(partnerId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["dm-thread", user?.id, partnerId],
    queryFn: async (): Promise<DirectMessage[]> => {
      if (!user || !partnerId) return [];

      const { data, error } = await (supabase as any)
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Filter out soft-deleted
      return (data || []).filter((m: DirectMessage) => {
        if (m.sender_id === user.id && m.deleted_by_sender) return false;
        if (m.recipient_id === user.id && m.deleted_by_recipient) return false;
        return true;
      });
    },
    enabled: !!user && !!partnerId,
  });

  // Realtime subscription — directly update cache for instant delivery
  useEffect(() => {
    if (!user || !partnerId) return;
    const channel = (supabase as any)
      .channel(`dm-thread-${user.id}-${partnerId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
      }, (payload: { new: DirectMessage }) => {
        const msg = payload.new;
        // Only append if this message belongs to the current conversation
        const isRelevant =
          (msg.sender_id === user.id && msg.recipient_id === partnerId) ||
          (msg.sender_id === partnerId && msg.recipient_id === user.id);
        if (!isRelevant) return;

        queryClient.setQueryData(
          ["dm-thread", user.id, partnerId],
          (old: DirectMessage[] = []) => {
            // Avoid duplicates
            if (old.some((m) => m.id === msg.id)) return old;
            return [...old, msg];
          }
        );
        queryClient.invalidateQueries({ queryKey: ["dm-conversations", user.id] });
        queryClient.invalidateQueries({ queryKey: ["dm-unread-count", user.id] });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "direct_messages",
      }, (payload: { new: DirectMessage }) => {
        const msg = payload.new;
        queryClient.setQueryData(
          ["dm-thread", user.id, partnerId],
          (old: DirectMessage[] = []) =>
            old.map((m) => (m.id === msg.id ? msg : m))
        );
      })
      .subscribe();
    return () => (supabase as any).removeChannel(channel);
  }, [user, partnerId, queryClient]);

  return query;
}

export function useSendDM() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recipientId, content }: { recipientId: string; content: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("direct_messages")
        .insert({ sender_id: user.id, recipient_id: recipientId, content: content.trim() });
      if (error) throw error;
    },
    onSuccess: (_, { recipientId }) => {
      queryClient.invalidateQueries({ queryKey: ["dm-thread", user?.id, recipientId] });
      queryClient.invalidateQueries({ queryKey: ["dm-conversations", user?.id] });
    },
  });
}

export function useMarkDMsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partnerId: string) => {
      if (!user) return;
      const { error } = await (supabase as any)
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .eq("sender_id", partnerId)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: (_, partnerId) => {
      queryClient.invalidateQueries({ queryKey: ["dm-thread", user?.id, partnerId] });
      queryClient.invalidateQueries({ queryKey: ["dm-conversations", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["dm-unread-count", user?.id] });
    },
  });
}

export function useDeleteDM() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, partnerId }: { messageId: string; partnerId: string }) => {
      if (!user) throw new Error("Not authenticated");
      const msg = await (supabase as any)
        .from("direct_messages")
        .select("sender_id, recipient_id")
        .eq("id", messageId)
        .single();

      const isSender = msg.data?.sender_id === user.id;
      const update = isSender ? { deleted_by_sender: true } : { deleted_by_recipient: true };

      const { error } = await (supabase as any)
        .from("direct_messages")
        .update(update)
        .eq("id", messageId);
      if (error) throw error;
      return partnerId;
    },
    onSuccess: (partnerId) => {
      queryClient.invalidateQueries({ queryKey: ["dm-thread", user?.id, partnerId] });
      queryClient.invalidateQueries({ queryKey: ["dm-conversations", user?.id] });
    },
  });
}

export function useUnreadDMCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dm-unread-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await (supabase as any)
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null)
        .eq("deleted_by_recipient", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30_000, // self-correct every 30s in case realtime lags
  });
}
