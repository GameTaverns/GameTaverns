import { useAchievements, type Achievement } from "@/hooks/useAchievements";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trophy } from "lucide-react";

interface AchievementBadgesProps {
  maxDisplay?: number;
  size?: "sm" | "md";
}

export function AchievementBadges({ maxDisplay = 5, size = "sm" }: AchievementBadgesProps) {
  const { userAchievements, totalPoints, TIER_COLORS, isLoading } = useAchievements();

  if (isLoading || userAchievements.length === 0) {
    return null;
  }

  const displayedAchievements = userAchievements.slice(0, maxDisplay);
  const remainingCount = userAchievements.length - maxDisplay;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {displayedAchievements.map((ua) => (
          <Tooltip key={ua.id}>
            <TooltipTrigger asChild>
              <span
                className={`
                  inline-flex items-center justify-center rounded-full
                  ${size === "sm" ? "h-6 w-6 text-sm" : "h-8 w-8 text-lg"}
                  ${TIER_COLORS[ua.achievement?.tier || 1]}
                  cursor-default
                `}
              >
                {ua.achievement?.icon || "🏆"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold">{ua.achievement?.name}</p>
              <p className="text-xs text-muted-foreground">{ua.achievement?.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={size === "sm" ? "text-xs" : "text-sm"}>
                +{remainingCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{remainingCount} more achievements</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1 ml-1">
              <Trophy className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
              {totalPoints}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total achievement points</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
