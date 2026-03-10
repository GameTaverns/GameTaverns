import { Star } from "lucide-react";
import { useReviewAggregate } from "@/hooks/useGameReviews";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReviewScoreBadgeProps {
  catalogId: string | undefined;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function ReviewScoreBadge({
  catalogId,
  size = "md",
  showLabel = true,
  className,
}: ReviewScoreBadgeProps) {
  const { data: aggregate } = useReviewAggregate(catalogId);

  if (!catalogId || !aggregate || aggregate.count === 0) return null;

  const score = aggregate.overall;
  const count = aggregate.count;

  // Color based on score
  const getScoreColor = (s: number) => {
    if (s >= 8) return "text-green-600 dark:text-green-400 bg-green-500/15 border-green-500/30";
    if (s >= 6) return "text-primary bg-primary/10 border-primary/30";
    if (s >= 4) return "text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/30";
    return "text-red-600 dark:text-red-400 bg-red-500/15 border-red-500/30";
  };

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSize = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  const badge = (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-semibold",
        sizeClasses[size],
        getScoreColor(score),
        className
      )}
    >
      <Star className={cn(iconSize[size], "fill-current")} />
      {score.toFixed(1)}
      {showLabel && (
        <span className="font-normal opacity-75">
          ({count})
        </span>
      )}
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <div className="font-semibold">Community Review Score: {score.toFixed(1)}/10</div>
          <div className="text-muted-foreground">Based on {count} review{count > 1 ? "s" : ""}</div>
          {aggregate.gameplay != null && (
            <div>Gameplay: {aggregate.gameplay.toFixed(1)}</div>
          )}
          {aggregate.components != null && (
            <div>Components: {aggregate.components.toFixed(1)}</div>
          )}
          {aggregate.replayability != null && (
            <div>Replayability: {aggregate.replayability.toFixed(1)}</div>
          )}
          {aggregate.value != null && (
            <div>Value: {aggregate.value.toFixed(1)}</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
