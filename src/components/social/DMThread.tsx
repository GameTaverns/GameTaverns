import { useState, useRef, useEffect } from "react";
import { Send, Trash2, CheckCheck, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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

interface DMThreadProps {
  partnerId: string;
  partnerName: string;
  partnerUsername: string | null;
  partnerAvatar: string | null;
}

export function DMThread({ partnerId, partnerName, partnerUsername, partnerAvatar }: DMThreadProps) {
  const { user } = useAuth();
  const { data: messages = [], isLoading } = useDMThread(partnerId);
  const sendDM = useSendDM();
  const markRead = useMarkDMsRead();
  const deleteDM = useDeleteDM();
  const { data: presenceStatus = "offline" } = useUserPresence(partnerId);
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Mark as read when thread opens
  useEffect(() => {
    markRead.mutate(partnerId);
  }, [partnerId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setContent("");
    sendDM.mutate({ recipientId: partnerId, content: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const initials = partnerName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-wood-medium/40 shrink-0">
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarImage src={partnerAvatar || undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <PresenceDot
            status={presenceStatus}
            className="absolute -bottom-0.5 -right-0.5"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-cream">{partnerName}</p>
          {partnerUsername && (
            <p className="text-xs text-cream/50">@{partnerUsername}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-3">
          {isLoading ? (
            <p className="text-xs text-cream/40 text-center py-8">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-cream/40 text-center py-8">
              No messages yet. Say hello! 👋
            </p>
          ) : (
            messages.map((msg: DirectMessage) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-2 group", isMine ? "flex-row-reverse" : "flex-row")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm relative",
                      isMine
                        ? "bg-secondary text-secondary-foreground rounded-tr-sm"
                        : "bg-wood-dark/60 text-cream rounded-tl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <div className={cn("flex items-center gap-1 mt-1", isMine ? "justify-end" : "justify-start")}>
                      <span className="text-[10px] opacity-60">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                      {isMine && (
                        msg.read_at
                          ? <CheckCheck className="h-3 w-3 opacity-60" />
                          : <Check className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 self-center"
                    onClick={() => deleteDM.mutate({ messageId: msg.id, partnerId })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Compose */}
      <div className="p-4 border-t border-wood-medium/40 shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            className="resize-none min-h-[38px] max-h-32 bg-wood-dark/40 border-wood-medium/40 text-cream placeholder:text-cream/30 text-sm"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={!content.trim() || sendDM.isPending}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-cream/30 mt-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
