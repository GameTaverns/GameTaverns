import { getRank, getNextRank, getRankProgress } from "@/lib/ranks";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RankBadgeProps {
  points: number;
  showProgress?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RankBadge({ points, showProgress = false, size = "md" }: RankBadgeProps) {
  const rank = getRank(points);
  const nextRank = getNextRank(points);
  const progress = getRankProgress(points);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={showProgress ? "space-y-1" : ""}>
            <Badge
              variant="secondary"
              className={`${sizeClasses[size]} ${rank.color} bg-card border border-border font-semibold`}
            >
              <span>{rank.icon}</span>
              {rank.name}
            </Badge>
            {showProgress && nextRank && (
              <div className="space-y-0.5">
                <Progress value={progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {points} / {nextRank.minPoints} pts to {nextRank.name}
                </p>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{rank.icon} {rank.name}</p>
          {nextRank ? (
            <p className="text-xs text-muted-foreground">
              {nextRank.minPoints - points} points to {nextRank.icon} {nextRank.name}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Maximum rank achieved!</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline rank flair shown next to usernames
 */
export function RankFlair({ points }: { points: number }) {
  const rank = getRank(points);
  if (!rank.titleFlair) return null;

  return (
    <span className={`text-xs font-medium ${rank.color} opacity-80`}>
      {rank.icon}
    </span>
  );
}
