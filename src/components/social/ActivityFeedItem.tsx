import { Gamepad2, Trophy, BookOpen, Dices, MessageSquare, Users, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActivityEvent } from "@/hooks/useActivityFeed";

const EVENT_CONFIG: Record<string, { icon: any; verb: string; color: string }> = {
  game_added: { icon: Gamepad2, verb: "Added a game", color: "text-blue-500" },
  session_logged: { icon: Dices, verb: "Logged a play session", color: "text-green-500" },
  achievement_earned: { icon: Trophy, verb: "Earned an achievement", color: "text-yellow-500" },
  expansion_added: { icon: BookOpen, verb: "Added an expansion", color: "text-purple-500" },
  forum_post: { icon: MessageSquare, verb: "Posted in a forum", color: "text-cyan-500" },
  library_created: { icon: Users, verb: "Created a library", color: "text-pink-500" },
  review_posted: { icon: Star, verb: "Posted a review", color: "text-amber-500" },
};

export function ActivityFeedItem({ event }: { event: ActivityEvent }) {
  const config = EVENT_CONFIG[event.event_type] || { icon: Dices, verb: event.event_type, color: "text-muted-foreground" };
  const Icon = config.icon;
  const detail = event.metadata?.title || event.metadata?.name || event.metadata?.description || "";

  return (
    <div className="flex gap-3 items-start">
      <div className={`mt-0.5 shrink-0 p-1.5 rounded-md bg-muted/50 ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">
          <span className="font-medium">{config.verb}</span>
          {detail && (
            <>
              {" · "}
              <span className="text-foreground/80">
                {event.metadata?.icon && <span className="mr-1">{event.metadata.icon}</span>}
                {detail}
              </span>
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
