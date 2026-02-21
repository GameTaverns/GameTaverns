import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Global listener that shows a toast when a new DM arrives,
 * regardless of which page the user is on.
 */
export function GlobalDMListener() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const channel = (supabase as any)
      .channel(`global-dm-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `recipient_id=eq.${user.id}`,
      }, async (payload: { new: any }) => {
        const msg = payload.new;
        // Don't notify for own messages
        if (msg.sender_id === user.id) return;

        // Invalidate DM queries so inbox/thread update
        queryClient.invalidateQueries({ queryKey: ["dm-conversations", user.id] });
        queryClient.invalidateQueries({ queryKey: ["dm-unread-count", user.id] });

        // Fetch sender name for the toast
        let senderName = "Someone";
        try {
          const { data } = await (supabase as any)
            .from("public_user_profiles")
            .select("display_name, username")
            .eq("user_id", msg.sender_id)
            .maybeSingle();
          if (data) {
            senderName = data.display_name || data.username || "Someone";
          }
        } catch { /* ignore */ }

        const preview = msg.content?.length > 80
          ? msg.content.substring(0, 80) + "…"
          : msg.content;

        toast({
          title: `💬 ${senderName}`,
          description: preview,
          action: (
            <button
              className="text-xs font-medium text-primary underline"
              onClick={() => navigate(`/dm/${msg.sender_id}`)}
            >
              View
            </button>
          ),
        });
      })
      .subscribe();

    return () => (supabase as any).removeChannel(channel);
  }, [user, toast, queryClient, navigate]);

  return null;
}
