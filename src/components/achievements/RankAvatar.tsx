/**
 * RankAvatar — Enhanced avatar with animated rank-based ring effects.
 * 
 * Tiers:
 *  - Novice: plain muted ring
 *  - Apprentice: warm amber glow
 *  - Journeyman: blue shimmer + subtle pulse
 *  - Tavern Regular: emerald glow + shadow
 *  - Game Master: golden rotating gradient border
 *  - Tavern Legend: purple aurora + particle sparkle animation
 */
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getRank } from "@/lib/ranks";
import { cn } from "@/lib/utils";

interface RankAvatarProps {
  src?: string | null;
  fallback: string;
  points: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-20 w-20 sm:h-28 sm:w-28",
  xl: "h-28 w-28 sm:h-36 sm:w-36",
};

const FALLBACK_SIZE = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-xl sm:text-2xl",
  xl: "text-2xl sm:text-3xl",
};

/**
 * Maps rank name → animated wrapper classes.
 * The inner Avatar still uses standard shadcn styling.
 */
function getRankRingClasses(rankName: string): string {
  switch (rankName) {
    case "Novice":
      return "ring-2 ring-muted-foreground/30";
    case "Apprentice":
      return "ring-2 ring-amber-500/60 shadow-[0_0_8px_rgba(217,119,6,0.3)]";
    case "Journeyman":
      return "ring-[3px] ring-blue-500/70 shadow-[0_0_12px_rgba(59,130,246,0.35)] animate-[rank-pulse_3s_ease-in-out_infinite]";
    case "Tavern Regular":
      return "ring-[3px] ring-emerald-500/80 shadow-[0_0_16px_rgba(16,185,129,0.4)] animate-[rank-pulse_2.5s_ease-in-out_infinite]";
    case "Game Master":
      return "rank-ring-gold ring-[4px] shadow-[0_0_20px_rgba(234,179,8,0.5)]";
    case "Tavern Legend":
      return "rank-ring-legend ring-[4px] shadow-[0_0_24px_rgba(168,85,247,0.6)]";
    default:
      return "ring-2 ring-muted";
  }
}

export function RankAvatar({ src, fallback, points, size = "lg", className }: RankAvatarProps) {
  const rank = getRank(points);
  const ringClasses = getRankRingClasses(rank.name);

  return (
    <div className={cn("relative inline-flex", className)}>
      {/* Legend sparkle particles */}
      {rank.name === "Tavern Legend" && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <span className="rank-sparkle rank-sparkle-1" />
          <span className="rank-sparkle rank-sparkle-2" />
          <span className="rank-sparkle rank-sparkle-3" />
        </div>
      )}
      <Avatar className={cn(
        SIZE_MAP[size],
        "border-4 border-card shadow-lg flex-shrink-0 relative z-10 transition-shadow duration-500",
        ringClasses,
      )}>
        <AvatarImage src={src || undefined} alt={fallback} className="object-cover" />
        <AvatarFallback className={cn(FALLBACK_SIZE[size], "font-display bg-primary/20 text-primary")}>
          {fallback}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
