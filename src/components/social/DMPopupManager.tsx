import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { DMPopup, type DMPopupPartner } from "./DMPopup";
import { FloatingMessengerBar } from "./FloatingMessengerBar";
import type { DirectMessage } from "@/hooks/useDirectMessages";

const MAX_OPEN_POPUPS = 3;
const POLL_INTERVAL_MS = 5000; // 5-second polling fallback

export function DMPopupManager() {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [popups, setPopups] = useState<DMPopupPartner[]>([]);
  const [newPopupId, setNewPopupId] = useState<string | null>(null);
  const fetchingRef = useRef<Set<string>>(new Set());
  const lastCheckedRef = useRef<string>(new Date().toISOString());
  const seenIdsRef = useRef<Set<string>>(new Set());

  const isDMPage = location.pathname.startsWith("/dm");

  const openPopup = (partner: DMPopupPartner, isNew = false) => {
    setPopups((prev) => {
      if (prev.some((p) => p.user_id === partner.user_id)) return prev;
      const next = [partner, ...prev].slice(0, MAX_OPEN_POPUPS);
      return next;
    });
    if (isNew) setNewPopupId(partner.user_id);
  };

  const closePopup = (userId: string) => {
    setPopups((prev) => prev.filter((p) => p.user_id !== userId));
  };

  const handleNewMessage = useCallback(async (msg: DirectMessage) => {
    if (!user) return;
    if (msg.recipient_id !== user.id) return;
    if (seenIdsRef.current.has(msg.id)) return;
    seenIdsRef.current.add(msg.id);

    // Cap seen IDs to prevent memory leak
    if (seenIdsRef.current.size > 200) {
      const arr = Array.from(seenIdsRef.current);
      seenIdsRef.current = new Set(arr.slice(-100));
    }

    queryClient.invalidateQueries({ queryKey: ["dm-unread-count", user.id] });

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
  }, [user, isDMPage, queryClient]);

  // Primary: Realtime subscription
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
  }, [user, handleNewMessage]);

  // Fallback: Polling for when Realtime/WebSocket is down
  useEffect(() => {
    if (!user) return;

    const poll = async () => {
      try {
        const { data } = await (supabase as any)
          .from("direct_messages")
          .select("id, sender_id, recipient_id, content, created_at, read_at")
          .eq("recipient_id", user.id)
          .gt("created_at", lastCheckedRef.current)
          .order("created_at", { ascending: true });

        if (data && data.length > 0) {
          lastCheckedRef.current = data[data.length - 1].created_at;
          for (const msg of data) {
            handleNewMessage(msg as DirectMessage);
          }
        }
      } catch (err) {
        // Silent fail — poll will retry
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, handleNewMessage]);

  const handleOpenFromBar = useCallback((partner: DMPopupPartner) => {
    openPopup(partner);
  }, []);

  if (!user) return null;

  return (
    <>
      {/* Floating messenger bar — desktop only; mobile uses bottom tabs */}
      {!isDMPage && (
        <div className="hidden md:block">
          <FloatingMessengerBar onOpenChat={handleOpenFromBar} />
        </div>
      )}

      {/* Popup windows */}
      {popups.length > 0 && !isDMPage && (
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
      )}
    </>
  );
}
