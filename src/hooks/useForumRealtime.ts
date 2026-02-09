import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import type { ForumThread, ForumReply } from "./useForum";

/**
 * Subscribe to realtime updates for a specific thread's replies
 */
export function useThreadRepliesRealtime(threadId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`forum-replies-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "forum_replies",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          // Fetch author data for the new reply
          const newReply = payload.new as ForumReply;
          
          const { data: authorData } = await supabase
            .from("user_profiles")
            .select(`
              user_id, 
              display_name,
              featured_achievement:achievements(name, icon, tier)
            `)
            .eq("user_id", newReply.author_id)
            .maybeSingle();

          const enrichedReply: ForumReply = {
            ...newReply,
            author: authorData
              ? {
                  display_name: authorData.display_name || "Unknown",
                  featured_badge: authorData.featured_achievement as { name: string; icon: string | null; tier: number } | null,
                }
              : { display_name: "Unknown" },
          };

          queryClient.setQueryData(
            ["forum-replies", threadId],
            (old: ForumReply[] | undefined) => {
              if (!old) return [enrichedReply];
              // Avoid duplicates
              if (old.some((r) => r.id === enrichedReply.id)) return old;
              return [...old, enrichedReply];
            }
          );

          // Also update the thread's reply_count
          queryClient.setQueryData(
            ["forum-thread", threadId],
            (old: ForumThread | undefined | null) => {
              if (!old) return old;
              return { ...old, reply_count: (old.reply_count || 0) + 1 };
            }
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "forum_replies",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const deletedReply = payload.old as { id: string };
          queryClient.setQueryData(
            ["forum-replies", threadId],
            (old: ForumReply[] | undefined) => {
              if (!old) return old;
              return old.filter((r) => r.id !== deletedReply.id);
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, queryClient]);
}

/**
 * Subscribe to realtime updates for threads in a category
 */
export function useCategoryThreadsRealtime(categoryId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!categoryId) return;

    const channel = supabase
      .channel(`forum-threads-${categoryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "forum_threads",
          filter: `category_id=eq.${categoryId}`,
        },
        async (payload) => {
          const newThread = payload.new as ForumThread;

          // Fetch author data
          const { data: authorData } = await supabase
            .from("user_profiles")
            .select(`
              user_id, 
              display_name,
              featured_achievement:achievements(name, icon, tier)
            `)
            .eq("user_id", newThread.author_id)
            .maybeSingle();

          const enrichedThread: ForumThread = {
            ...newThread,
            author: authorData
              ? {
                  display_name: authorData.display_name || "Unknown",
                  featured_badge: authorData.featured_achievement as { name: string; icon: string | null; tier: number } | null,
                }
              : { display_name: "Unknown" },
          };

          // Invalidate to refetch with proper ordering
          queryClient.invalidateQueries({ queryKey: ["forum-threads", categoryId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "forum_threads",
          filter: `category_id=eq.${categoryId}`,
        },
        () => {
          // Invalidate to refetch with updated data (pin/lock status, reply count, etc.)
          queryClient.invalidateQueries({ queryKey: ["forum-threads", categoryId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "forum_threads",
          filter: `category_id=eq.${categoryId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["forum-threads", categoryId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryId, queryClient]);
}
