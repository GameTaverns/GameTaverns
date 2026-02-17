import { Link } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Gamepad2, Trophy, BookOpen, Dices, MessageSquare, Users, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActivityEvent } from "@/hooks/useActivityFeed";

const EVENT_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  game_added: { icon: Gamepad2, label: "added a game", color: "text-blue-500" },
  session_logged: { icon: Dices, label: "logged a play session", color: "text-green-500" },
  achievement_earned: { icon: Trophy, label: "earned an achievement", color: "text-yellow-500" },
  expansion_added: { icon: BookOpen, label: "added an expansion", color: "text-purple-500" },
  forum_post: { icon: MessageSquare, label: "posted in a forum", color: "text-cyan-500" },
  library_created: { icon: Users, label: "created a library", color: "text-pink-500" },
  review_posted: { icon: Star, label: "posted a review", color: "text-amber-500" },
};

export function ActivityFeedItem({ event }: { event: ActivityEvent }) {
  const config = EVENT_CONFIG[event.event_type] || { icon: Dices, label: event.event_type, color: "text-muted-foreground" };
  const Icon = config.icon;

  const initials = (event.user_display_name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const detail = event.metadata?.title || event.metadata?.name || event.metadata?.description || "";

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <Link to={event.user_username ? `/u/${event.user_username}` : "#"}>
        <Avatar className="h-9 w-9">
          <AvatarImage src={event.user_avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <Link
            to={event.user_username ? `/u/${event.user_username}` : "#"}
            className="font-medium text-foreground hover:underline"
          >
            {event.user_display_name}
          </Link>{" "}
          <span className="text-muted-foreground">{config.label}</span>
        </p>
        {detail && (
          <p className="text-sm text-foreground/80 truncate mt-0.5">
            {event.metadata?.icon && <span className="mr-1">{event.metadata.icon}</span>}
            {detail}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
        </p>
      </div>
      <div className={`shrink-0 mt-1 ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}
