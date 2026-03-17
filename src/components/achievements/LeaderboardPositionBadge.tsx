/**
 * LeaderboardPositionBadge — shiny pill showing user's leaderboard rank.
 * Shows "#3 on Leaderboard" with placement-specific styling.
 */
import { Trophy, Medal, Award, Crown } from "lucide-react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { cn } from "@/lib/utils";

interface LeaderboardPositionBadgeProps {
  userId: string | undefined;
  className?: string;
}

export function LeaderboardPositionBadge({ userId, className }: LeaderboardPositionBadgeProps) {
  const { data: entries = [], isLoading } = useLeaderboard(50);

  if (isLoading || !userId || entries.length === 0) return null;

  const position = entries.findIndex((e) => e.user_id === userId);
  if (position === -1) return null;

  const rank = position + 1;

  // Styling per placement
  const config = getPositionConfig(rank);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold select-none transition-all",
        config.classes,
        className,
      )}
    >
      <config.icon className="h-3.5 w-3.5" />
      #{rank} on Leaderboard
    </span>
  );
}

function getPositionConfig(rank: number) {
  if (rank === 1)
    return {
      icon: Crown,
      classes:
        "bg-gradient-to-r from-yellow-400/20 to-amber-500/20 text-yellow-500 border border-yellow-500/40 shadow-[0_0_10px_rgba(234,179,8,0.25)]",
    };
  if (rank === 2)
    return {
      icon: Medal,
      classes:
        "bg-gradient-to-r from-slate-300/20 to-slate-400/20 text-slate-400 border border-slate-400/40 shadow-[0_0_8px_rgba(148,163,184,0.2)]",
    };
  if (rank === 3)
    return {
      icon: Award,
      classes:
        "bg-gradient-to-r from-amber-700/20 to-orange-600/20 text-amber-600 border border-amber-600/40 shadow-[0_0_8px_rgba(180,83,9,0.2)]",
    };
  if (rank <= 10)
    return {
      icon: Trophy,
      classes:
        "bg-primary/10 text-primary border border-primary/30",
    };
  return {
    icon: Trophy,
    classes: "bg-muted text-muted-foreground border border-border",
  };
}
