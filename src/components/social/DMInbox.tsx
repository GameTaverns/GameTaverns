import { useState } from "react";
import { MessageSquare, Search, PenSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDMConversations, type DMConversation } from "@/hooks/useDirectMessages";
import { useUserPresence } from "@/hooks/usePresence";
import { PresenceDot } from "@/components/social/PresenceDot";

interface DMInboxProps {
  selectedUserId: string | null;
  onSelectConversation: (conv: DMConversation) => void;
  onNewMessage: () => void;
}

function ConversationRow({
  conv,
  isSelected,
  onClick,
}: {
  conv: DMConversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { data: status = "offline" } = useUserPresence(conv.user_id);
  const initials = (conv.display_name || conv.username || "?")
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
        isSelected
          ? "bg-secondary/20 border border-secondary/30"
          : "hover:bg-wood-dark/40"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarImage src={conv.avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <PresenceDot status={status} className="absolute -bottom-0.5 -right-0.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm truncate", conv.unread_count > 0 ? "font-semibold text-cream" : "text-cream/80")}>
            {conv.display_name || conv.username}
          </span>
          <span className="text-[10px] text-cream/40 shrink-0">
            {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-cream/50 truncate">{conv.last_message}</p>
          {conv.unread_count > 0 && (
            <Badge variant="destructive" className="h-4 px-1.5 text-[10px] shrink-0">
              {conv.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

export function DMInbox({ selectedUserId, onSelectConversation, onNewMessage }: DMInboxProps) {
  const { data: conversations = [], isLoading } = useDMConversations();
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? conversations.filter(
        (c) =>
          c.display_name?.toLowerCase().includes(filter.toLowerCase()) ||
          c.username?.toLowerCase().includes(filter.toLowerCase())
      )
    : conversations;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-wood-medium/40 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-cream flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-secondary" />
            Messages
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-cream/60 hover:text-cream"
            onClick={onNewMessage}
            title="New message"
          >
            <PenSquare className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream/40" />
          <Input
            placeholder="Search conversations…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 h-8 text-sm bg-wood-dark/40 border-wood-medium/40 text-cream placeholder:text-cream/30"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <p className="text-xs text-cream/40 text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 mx-auto text-cream/20 mb-2" />
              <p className="text-xs text-cream/50">
                {filter ? "No conversations match" : "No messages yet"}
              </p>
              {!filter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs border-wood-medium/40 text-cream/70"
                  onClick={onNewMessage}
                >
                  Start a conversation
                </Button>
              )}
            </div>
          ) : (
            filtered.map((conv) => (
              <ConversationRow
                key={conv.user_id}
                conv={conv}
                isSelected={selectedUserId === conv.user_id}
                onClick={() => onSelectConversation(conv)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
