import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { DMPopup, type DMPopupPartner } from "./DMPopup";
import type { DirectMessage } from "@/hooks/useDirectMessages";

const MAX_OPEN_POPUPS = 3;

export function DMPopupManager() {
  const { user } = useAuth();
  const location = useLocation();
  const [popups, setPopups] = useState<DMPopupPartner[]>([]);
  const [newPopupId, setNewPopupId] = useState<string | null>(null);
  const fetchingRef = useRef<Set<string>>(new Set());

  // Don't show popups on the DM page itself
  const isDMPage = location.pathname.startsWith("/dm");

  const openPopup = (partner: DMPopupPartner, isNew = false) => {
    setPopups((prev) => {
      // Already open — bring to front
      if (prev.some((p) => p.user_id === partner.user_id)) return prev;
      const next = [partner, ...prev].slice(0, MAX_OPEN_POPUPS);
      return next;
    });
    if (isNew) setNewPopupId(partner.user_id);
  };

  const closePopup = (userId: string) => {
    setPopups((prev) => prev.filter((p) => p.user_id !== userId));
  };

  // Fetch sender profile and open popup
  const handleNewMessage = async (msg: DirectMessage) => {
    if (!user) return;
    if (msg.recipient_id !== user.id) return; // Only react to incoming messages
    if (isDMPage) return;

    const senderId = msg.sender_id;
    if (fetchingRef.current.has(senderId)) return;
    fetchingRef.current.add(senderId);

    try {
      const { data } = await (supabase as any)
        .from("public_user_profiles")
        .select("user_id, display_name, username, avatar_url")
        .eq("user_id", senderId)
        .maybeSingle();

      if (data) {
        openPopup(
          {
            user_id: data.user_id,
            display_name: data.display_name,
            username: data.username,
            avatar_url: data.avatar_url,
          },
          true
        );
      }
    } finally {
      fetchingRef.current.delete(senderId);
    }
  };

  useEffect(() => {
    if (!user) return;

    const channel = (supabase as any)
      .channel(`dm-popup-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload: { new: DirectMessage }) => {
          handleNewMessage(payload.new);
        }
      )
      .subscribe();

    return () => (supabase as any).removeChannel(channel);
  }, [user, isDMPage]);

  if (isDMPage || popups.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-4 z-50 flex items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {[...popups].reverse().map((partner) => (
          <div key={partner.user_id} className="pointer-events-auto">
            <DMPopup
              partner={partner}
              onClose={() => closePopup(partner.user_id)}
              isNew={newPopupId === partner.user_id}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
