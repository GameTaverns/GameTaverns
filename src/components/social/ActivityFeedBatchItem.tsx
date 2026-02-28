import { Link } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Gamepad2, BookOpen, Camera } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { BatchedActivityEvent } from "@/utils/groupActivityEvents";
import { ActivityReactionButton } from "@/components/social/ActivityReactionButton";
import { MentionRenderer } from "@/components/photos/MentionRenderer";

export function ActivityFeedBatchItem({
  batch,
  showUser = false,
}: {
  batch: BatchedActivityEvent;
  showUser?: boolean;
}) {
  const isPhotoBatch = batch.event_type === "photos_posted_batch";
  const gameCount = batch.events.filter((e) => e.event_type === "game_added").length;
  const expansionCount = batch.events.filter((e) => e.event_type === "expansion_added").length;

  let summary: string;
  let caption: string | null = null;
  if (isPhotoBatch) {
    const photoCount = batch.events.length;
    summary = `Posted ${photoCount} photo${photoCount !== 1 ? "s" : ""}`;
    caption = batch.events[0]?.metadata?.caption as string | null;
  } else {
    const parts: string[] = [];
    if (gameCount > 0) parts.push(`${gameCount} game${gameCount !== 1 ? "s" : ""}`);
    if (expansionCount > 0) parts.push(`${expansionCount} expansion${expansionCount !== 1 ? "s" : ""}`);
    summary = `Added ${parts.join(" and ")}`;
  }

  const BatchIcon = isPhotoBatch ? Camera : Gamepad2;
  const batchColor = isPhotoBatch ? "text-rose-500" : "text-blue-500";

  const initials = (batch.user_display_name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Collect thumbnails (image_url from metadata)
  const thumbnails = batch.events
    .map((e) => ({
      title: e.metadata?.title || "Game",
      image: e.metadata?.image_url as string | undefined,
      slug: e.metadata?.slug as string | undefined,
    }))
    .slice(0, 9);

  // Determine grid columns based on count
  const gridCols =
    thumbnails.length <= 1
      ? "grid-cols-1"
      : thumbnails.length <= 4
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className="flex gap-3 items-start">
      {showUser && (
        <Link to={batch.user_username ? `/u/${batch.user_username}` : "#"} className="shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={batch.user_avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
        </Link>
      )}
      {!showUser && (
        <div className={`mt-0.5 shrink-0 p-1.5 rounded-md bg-muted/50 ${batchColor}`}>
          <BatchIcon className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          {showUser && batch.user_display_name && (
            <>
              <Link
                to={batch.user_username ? `/u/${batch.user_username}` : "#"}
                className="font-medium text-foreground hover:underline"
              >
                {batch.user_display_name}
              </Link>{" "}
            </>
          )}
          <span className={showUser ? "text-muted-foreground" : "font-medium text-foreground"}>
            {showUser ? summary.toLowerCase() : summary}
          </span>
          {caption && (
            <>
              {" · "}
              <MentionRenderer caption={caption} className="text-foreground/80" />
            </>
          )}
        </p>

        {/* Thumbnail grid */}
        <div className={`grid ${gridCols} gap-1 mt-2 max-w-[280px]`}>
          {thumbnails.map((t, i) => (
            <div
              key={i}
              className="aspect-square rounded-md overflow-hidden bg-muted/30 border border-border/30"
              title={t.title}
            >
              {t.image ? (
                <img
                  src={t.image}
                  alt={t.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Gamepad2 className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(batch.created_at), { addSuffix: true })}
          </p>
          {/* Reaction on the first event in the batch */}
          <ActivityReactionButton eventId={batch.events[0].id} />
        </div>
      </div>
      {showUser && (
        <div className={`shrink-0 mt-1 ${batchColor}`}>
          <BatchIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
