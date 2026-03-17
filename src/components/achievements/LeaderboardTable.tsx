import { Link } from "react-router-dom";
import { useLeaderboard, type LeaderboardEntry } from "@/hooks/useLeaderboard";
import { getRank } from "@/lib/ranks";
import { RankAvatar } from "@/components/achievements/RankAvatar";
import { RankUsername } from "@/components/achievements/RankUsername";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award, Crown } from "lucide-react";

function getPlacementIcon(index: number) {
  if (index === 0) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (index === 1) return <Medal className="h-5 w-5 text-slate-400" />;
  if (index === 2) return <Award className="h-5 w-5 text-amber-700" />;
  return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{index + 1}</span>;
}

export function LeaderboardTable() {
  const { data: entries = [], isLoading } = useLeaderboard(50);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No rankings yet. Start earning achievements!</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry, index) => (
        <LeaderboardRow key={entry.user_id} entry={entry} index={index} />
      ))}
    </div>
  );
}

function LeaderboardRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const rank = getRank(entry.grand_total);
  const initials = (entry.display_name || entry.username || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isTop3 = index < 3;

  return (
    <Link
      to={`/u/${entry.username}`}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-accent/50 ${
        isTop3 ? "bg-card border border-border" : ""
      }`}
    >
      {/* Position */}
      <div className="w-8 flex justify-center shrink-0">
        {getPlacementIcon(index)}
      </div>

      {/* Avatar */}
      <RankAvatar
        src={entry.avatar_url}
        fallback={initials}
        points={entry.grand_total}
        size="sm"
      />

      {/* Name + Rank */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {entry.display_name || entry.username}
          </span>
          <Badge variant="secondary" className={`text-xs ${rank.color} bg-transparent border-0 px-1`}>
            {rank.icon} {rank.name}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {entry.achievements_earned} badges
          {entry.quest_bonus > 0 && ` • +${entry.quest_bonus} quest bonus`}
        </p>
      </div>

      {/* Points */}
      <div className="text-right shrink-0">
        <div className="font-bold text-primary">{entry.grand_total}</div>
        <div className="text-xs text-muted-foreground">pts</div>
      </div>
    </Link>
  );
}
