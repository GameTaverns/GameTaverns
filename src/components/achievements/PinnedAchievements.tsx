/**
 * PinnedAchievements — shows top achievements as mini icon pills next to username.
 * Auto-selects highest-tier earned achievements (up to 5).
 */
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PinnedAchievement {
  id: string;
  name: string;
  icon: string | null;
  tier: number;
  points: number;
}

interface PinnedAchievementsProps {
  achievements: PinnedAchievement[];
  max?: number;
  size?: "xs" | "sm";
}

const TIER_BG: Record<number, string> = {
  1: "bg-amber-100/60 dark:bg-amber-900/30 border-amber-300/50",
  2: "bg-slate-100/60 dark:bg-slate-700/30 border-slate-300/50",
  3: "bg-yellow-100/60 dark:bg-yellow-900/30 border-yellow-400/50",
  4: "bg-purple-100/60 dark:bg-purple-900/30 border-purple-400/50",
};

export function PinnedAchievements({ achievements, max = 5, size = "sm" }: PinnedAchievementsProps) {
  if (!achievements || achievements.length === 0) return null;

  // Sort by tier desc, then points desc, take top N
  const pinned = [...achievements]
    .sort((a, b) => b.tier - a.tier || b.points - a.points)
    .slice(0, max);

  const iconSize = size === "xs" ? "text-xs" : "text-sm";
  const pillSize = size === "xs" ? "h-5 w-5" : "h-6 w-6";

  return (
    <div className="inline-flex items-center gap-0.5">
      {pinned.map((a) => (
        <Tooltip key={a.id}>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full border cursor-default transition-transform hover:scale-110",
                pillSize,
                TIER_BG[a.tier] || TIER_BG[1],
              )}
            >
              <span className={iconSize}>{a.icon || "🏆"}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {a.name} • {a.points} pts
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
