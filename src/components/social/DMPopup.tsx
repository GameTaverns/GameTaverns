import { useState, useRef, useEffect } from "react";
import { X, Minus, Send, ChevronDown, Trash2, Check, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import {
  useDMThread,
  useSendDM,
  useMarkDMsRead,
  useDeleteDM,
  type DirectMessage,
} from "@/hooks/useDirectMessages";
import { useUserPresence } from "@/hooks/usePresence";
import { PresenceDot } from "@/components/social/PresenceDot";
import { cn } from "@/lib/utils";

export interface DMPopupPartner {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface DMPopupProps {
  partner: DMPopupPartner;
  onClose: () => void;
  isNew?: boolean; // Slides in with animation when a new message arrives
}

export function DMPopup({ partner, onClose, isNew = false }: DMPopupProps) {
  const { user } = useAuth();
  const { data: messages = [], isLoading } = useDMThread(partner.user_id);
  const sendDM = useSendDM();
  const markRead = useMarkDMsRead();
  const deleteDM = useDeleteDM();
  const { data: presenceStatus = "offline" } = useUserPresence(partner.user_id);
  const [content, setContent] = useState("");
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  // Mark as read when opened/expanded
  useEffect(() => {
    if (!minimized) {
      markRead.mutate(partner.user_id);
    }
  }, [partner.user_id, minimized]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!minimized && messages.length !== prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      prevMessageCount.current = messages.length;
    }
  }, [messages.length, minimized]);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setContent("");
    sendDM.mutate({ recipientId: partner.user_id, content: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const initials = (partner.display_name || partner.username || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const unreadCount = messages.filter(
    (m) => m.recipient_id === user?.id && !m.read_at
  ).length;

  return (
    <motion.div
      initial={isNew ? { y: 40, opacity: 0 } : { y: 0, opacity: 1 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex flex-col w-72 shadow-2xl rounded-t-xl overflow-hidden border border-wood-medium/50 bg-wood-dark"
      style={{ maxHeight: minimized ? "auto" : "420px" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3 py-2 bg-wood-medium/60 cursor-pointer select-none shrink-0"
        onClick={() => setMinimized(!minimized)}
      >
        <div className="relative shrink-0">
          <Avatar className="h-7 w-7">
            <AvatarImage src={partner.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <PresenceDot
            status={presenceStatus}
            className="absolute -bottom-0.5 -right-0.5 scale-75"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-cream truncate leading-tight">
            {partner.display_name || partner.username}
          </p>
          {partner.username && (
            <p className="text-[10px] text-cream/50 truncate leading-none">
              @{partner.username}
            </p>
          )}
        </div>

        {minimized && unreadCount > 0 && (
          <span className="shrink-0 bg-destructive text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className="p-1 rounded hover:bg-wood-dark/40 text-cream/60 hover:text-cream transition-colors"
            onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }}
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <ChevronDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </button>
          <button
            className="p-1 rounded hover:bg-destructive/20 text-cream/60 hover:text-destructive transition-colors"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {!minimized && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 overflow-hidden"
            style={{ maxHeight: "375px" }}
          >
            {/* Messages */}
            <ScrollArea className="flex-1 px-3">
              <div className="py-3 space-y-2">
                {isLoading ? (
                  <p className="text-xs text-cream/40 text-center py-4">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-cream/40 text-center py-4">Say hello! 👋</p>
                ) : (
                  messages.map((msg: DirectMessage) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex gap-1.5 group", isMine ? "flex-row-reverse" : "flex-row")}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-3 py-1.5 text-xs relative",
                            isMine
                              ? "bg-secondary text-secondary-foreground rounded-tr-sm"
                              : "bg-wood-medium/60 text-cream rounded-tl-sm"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words leading-snug">{msg.content}</p>
                          <div className={cn("flex items-center gap-0.5 mt-0.5 opacity-60", isMine ? "justify-end" : "justify-start")}>
                            <span className="text-[9px]">
                              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                            </span>
                            {isMine && (
                              msg.read_at
                                ? <CheckCheck className="h-2.5 w-2.5" />
                                : <Check className="h-2.5 w-2.5" />
                            )}
                          </div>
                        </div>
                        <button
                          className="opacity-0 group-hover:opacity-100 self-center text-muted-foreground hover:text-destructive transition-all p-0.5 shrink-0"
                          onClick={() => deleteDM.mutate({ messageId: msg.id, partnerId: partner.user_id })}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Compose */}
            <div className="px-3 pb-3 pt-1 shrink-0 border-t border-wood-medium/30">
              <div className="flex gap-1.5 items-end">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message…"
                  rows={1}
                  className="resize-none min-h-[32px] max-h-20 text-xs bg-wood-medium/30 border-wood-medium/40 text-cream placeholder:text-cream/30"
                />
                <Button
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={!content.trim() || sendDM.isPending}
                  onClick={handleSend}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
