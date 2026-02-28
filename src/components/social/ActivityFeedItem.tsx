import { Link } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Gamepad2, Trophy, BookOpen, Dices, MessageSquare, Users, Star, Camera, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActivityEvent } from "@/hooks/useActivityFeed";
import { ActivityReactionButton } from "@/components/social/ActivityReactionButton";
import { MentionRenderer } from "@/components/photos/MentionRenderer";
import { useDeleteActivityEvent } from "@/hooks/useDeleteActivityEvent";
import { ImageLightbox } from "@/components/ui/image-lightbox";

const EVENT_CONFIG: Record<string, { icon: any; verb: string; color: string }> = {
  game_added: { icon: Gamepad2, verb: "Added a game", color: "text-blue-500" },
  session_logged: { icon: Dices, verb: "Logged a play session", color: "text-green-500" },
  achievement_earned: { icon: Trophy, verb: "Earned an achievement", color: "text-yellow-500" },
  expansion_added: { icon: BookOpen, verb: "Added an expansion", color: "text-purple-500" },
  forum_post: { icon: MessageSquare, verb: "Posted in a forum", color: "text-cyan-500" },
  library_created: { icon: Users, verb: "Created a library", color: "text-pink-500" },
  review_posted: { icon: Star, verb: "Posted a review", color: "text-amber-500" },
  photo_posted: { icon: Camera, verb: "Posted a photo", color: "text-rose-500" },
  photo_tagged: { icon: Camera, verb: "Was tagged in a photo", color: "text-rose-500" },
};

export function ActivityFeedItem({ event, showUser = false, canDelete = false }: { event: ActivityEvent; showUser?: boolean; canDelete?: boolean }) {
  const deleteEvent = useDeleteActivityEvent();
  const config = EVENT_CONFIG[event.event_type] || { icon: Dices, verb: event.event_type, color: "text-muted-foreground" };
  const Icon = config.icon;
  const detail = event.metadata?.title || event.metadata?.name || event.metadata?.caption || event.metadata?.description || "";
  const photoUrl = (event.event_type === "photo_posted" || event.event_type === "photo_tagged") ? event.metadata?.image_url : null;

  const initials = (event.user_display_name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex gap-3 items-start">
      {showUser && (
        <Link to={event.user_username ? `/u/${event.user_username}` : "#"} className="shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={event.user_avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
        </Link>
      )}
      {!showUser && (
        <div className={`mt-0.5 shrink-0 p-1.5 rounded-md bg-muted/50 ${config.color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          {showUser && event.user_display_name && (
            <>
              <Link
                to={event.user_username ? `/u/${event.user_username}` : "#"}
                className="font-medium text-foreground hover:underline"
              >
                {event.user_display_name}
              </Link>{" "}
            </>
          )}
          {!showUser && event.event_type === "photo_tagged" && event.metadata?.tagged_by_display_name && (
            <>
              <Link
                to={event.metadata?.tagged_by_username ? `/u/${event.metadata.tagged_by_username}` : "#"}
                className="font-medium text-foreground hover:underline"
              >
                {event.metadata.tagged_by_display_name as string}
              </Link>{" "}
              <span className="text-muted-foreground">tagged you</span>
            </>
          )}
          {!((!showUser && event.event_type === "photo_tagged" && event.metadata?.tagged_by_display_name)) && (
            <span className={showUser ? "text-muted-foreground" : "font-medium text-foreground"}>
              {showUser ? config.verb.toLowerCase() : config.verb}
            </span>
          )}
          {detail && (
            <>
              {" · "}
              {(event.event_type === "photo_posted" || event.event_type === "photo_tagged") ? (
                <MentionRenderer caption={detail} className="text-foreground/80" />
              ) : (
                <span className="text-foreground/80">
                  {event.metadata?.icon && <span className="mr-1">{event.metadata.icon}</span>}
                  {detail}
                </span>
              )}
            </>
          )}
        </p>
        {photoUrl && (
          <ImageLightbox src={photoUrl} alt={detail || "Photo"}>
            <img
              src={photoUrl}
              alt={detail || "Photo"}
              className="mt-2 rounded-md max-h-64 object-cover w-full hover:opacity-90 transition-opacity"
              loading="lazy"
            />
          </ImageLightbox>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
          </p>
          <ActivityReactionButton eventId={event.id} />
          {canDelete && (
            <button
              onClick={() => deleteEvent.mutate([event.id])}
              disabled={deleteEvent.isPending}
              className="text-muted-foreground/50 hover:text-destructive transition-colors"
              title="Remove from feed"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {showUser && (
        <div className={`shrink-0 mt-1 ${config.color}`}>
          <Icon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
