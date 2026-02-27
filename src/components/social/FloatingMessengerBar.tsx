import { useState, useMemo } from "react";
import { MessageSquare, ChevronUp, ChevronDown, Search, X, Pencil } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceDot } from "@/components/social/PresenceDot";
import { useAuth } from "@/hooks/useAuth";
import { useDMConversations, useUnreadDMCount, type DMConversation } from "@/hooks/useDirectMessages";
import { useMultiPresence, type PresenceStatus } from "@/hooks/usePresence";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface FloatingMessengerBarProps {
  onOpenChat: (partner: { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null }) => void;
}

export function FloatingMessengerBar({ onOpenChat }: FloatingMessengerBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const { data: conversations = [] } = useDMConversations();
  const { data: totalUnread = 0 } = useUnreadDMCount();

  // Get presence for all conversation partners
  const partnerIds = useMemo(() => conversations.map((c) => c.user_id), [conversations]);
  const { data: presenceMap = new Map<string, PresenceStatus>() } = useMultiPresence(partnerIds);

  // Sort: online first, then by last message
  const sortedConversations = useMemo(() => {
    const statusOrder: Record<PresenceStatus, number> = { online: 0, idle: 1, offline: 2 };
    return [...conversations].sort((a, b) => {
      const aStatus = presenceMap.get(a.user_id) || "offline";
      const bStatus = presenceMap.get(b.user_id) || "offline";
      if (statusOrder[aStatus] !== statusOrder[bStatus]) {
        return statusOrder[aStatus] - statusOrder[bStatus];
      }
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  }, [conversations, presenceMap]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sortedConversations;
    const q = search.toLowerCase();
    return sortedConversations.filter(
      (c) =>
        c.display_name?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q)
    );
  }, [sortedConversations, search]);

  const onlineCount = useMemo(
    () => [...presenceMap.values()].filter((s) => s === "online").length,
    [presenceMap]
  );

  if (!user) return null;

  const initials = (name: string | null) =>
    (name || "?").split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2);

  // ─── Mobile: Facebook-style floating bubble ───
  if (isMobile) {
    return (
      null
    );
  }

  // ─── Desktop: Expanded messenger bar ───
  return (
    <div className="fixed bottom-0 right-6 z-40 pointer-events-auto">
      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-72 bg-wood-dark border border-b-0 border-wood-medium/50 rounded-t-xl overflow-hidden shadow-2xl"
          >
            {/* Search */}
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-8 pr-8 py-1.5 text-xs rounded-md bg-wood-medium/30 border border-wood-medium/40 text-cream placeholder:text-cream/30 focus:outline-none focus:ring-1 focus:ring-secondary/50"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-cream/40 hover:text-cream"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Conversation list */}
            <div className="max-h-80 overflow-y-auto px-1 pb-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-cream/40 text-center py-6">
                  {search ? "No results" : "No conversations yet"}
                </p>
              ) : (
                filtered.map((conv) => {
                  const status = presenceMap.get(conv.user_id) || "offline";
                  return (
                    <button
                      key={conv.user_id}
                      onClick={() => {
                        onOpenChat({
                          user_id: conv.user_id,
                          display_name: conv.display_name,
                          username: conv.username,
                          avatar_url: conv.avatar_url,
                        });
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-wood-medium/30 transition-colors text-left group",
                        conv.unread_count > 0 && "bg-wood-medium/20"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={conv.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-bold">
                            {initials(conv.display_name || conv.username)}
                          </AvatarFallback>
                        </Avatar>
                        <PresenceDot
                          status={status}
                          className="absolute -bottom-0.5 -right-0.5 scale-75"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs truncate leading-tight",
                          conv.unread_count > 0 ? "text-cream font-semibold" : "text-cream/80"
                        )}>
                          {conv.display_name || conv.username}
                        </p>
                        <p className="text-[10px] text-cream/40 truncate leading-snug mt-0.5">
                          {conv.last_message}
                        </p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="shrink-0 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                          {conv.unread_count > 9 ? "9+" : conv.unread_count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* New message / view all */}
            <div className="border-t border-wood-medium/30 px-3 py-2 flex items-center gap-2">
              <button
                onClick={() => { setExpanded(false); navigate("/dm"); }}
                className="flex-1 text-[10px] text-cream/50 hover:text-cream transition-colors text-center"
              >
                View All Messages
              </button>
              <button
                onClick={() => { setExpanded(false); navigate("/dm"); }}
                className="p-1.5 rounded-md bg-secondary/20 hover:bg-secondary/40 text-secondary transition-colors"
                title="New message"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-t-xl bg-wood-dark border border-b-0 border-wood-medium/50 shadow-lg hover:bg-wood-medium/40 transition-colors",
          expanded && "rounded-t-none border-t-0"
        )}
      >
        <MessageSquare className="h-4 w-4 text-secondary" />
        <span className="text-xs font-semibold text-cream">Messenger</span>
        {onlineCount > 0 && (
          <span className="text-[10px] text-green-400">
            {onlineCount} online
          </span>
        )}
        {!expanded && totalUnread > 0 && (
          <span className="bg-destructive text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-cream/50 ml-auto" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-cream/50 ml-auto" />
        )}
      </button>
    </div>
  );
}
