import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActivityReactions, useToggleReaction } from "@/hooks/useActivityReactions";
import { useAuth } from "@/hooks/useAuth";

interface ActivityReactionButtonProps {
  eventId: string;
}

export function ActivityReactionButton({ eventId }: ActivityReactionButtonProps) {
  const { user } = useAuth();
  const { likeCount, hasLiked, isLoading } = useActivityReactions(eventId);
  const toggleReaction = useToggleReaction(eventId);

  if (!user) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-auto py-0.5 px-1.5 gap-1 text-xs text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10",
        hasLiked && "text-pink-500"
      )}
      disabled={isLoading || toggleReaction.isPending}
      onClick={() => toggleReaction.mutate(hasLiked)}
    >
      <Heart
        className={cn("h-3.5 w-3.5", hasLiked && "fill-current")}
      />
      {likeCount > 0 && <span>{likeCount}</span>}
    </Button>
  );
}
