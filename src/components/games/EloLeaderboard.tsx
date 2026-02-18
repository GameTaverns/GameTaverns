import { Trophy, TrendingUp, Medal, Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGameLeaderboard } from "@/hooks/usePlayerElo";
import { Link } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { cn } from "@/lib/utils";

interface EloLeaderboardProps {
  gameId: string;
  gameTitle?: string;
}

const RANK_ICONS = [
  <Crown className="h-4 w-4 text-secondary" />,
  <Medal className="h-4 w-4 text-muted-foreground" />,
  <Medal className="h-4 w-4 text-muted-foreground/70" />,
];

function eloTier(elo: number) {
  if (elo >= 1400) return { label: "Elite", className: "bg-primary/20 text-primary border-primary/30" };
  if (elo >= 1200) return { label: "Expert", className: "bg-accent/60 text-accent-foreground border-border" };
  if (elo >= 1100) return { label: "Advanced", className: "bg-secondary/20 text-secondary-foreground border-secondary/30" };
  if (elo >= 1000) return { label: "Intermediate", className: "bg-muted text-muted-foreground border-border" };
  return { label: "Beginner", className: "bg-muted text-muted-foreground border-border" };
}

export function EloLeaderboard({ gameId, gameTitle }: EloLeaderboardProps) {
  const { tenantSlug } = useTenant();
  const { data: players = [], isLoading } = useGameLeaderboard(gameId);

  const profileUrl = (username: string | null) => {
    const path = `/u/${username}`;
    return tenantSlug ? getLibraryUrl(tenantSlug, path) : path;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <Trophy className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>No ranked players yet.</p>
        <p className="text-xs mt-1">Log sessions and link profiles to build the leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {gameTitle && (
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{gameTitle} Rankings</span>
        </div>
      )}
      {players.map((player, idx) => {
        const tier = eloTier(player.elo);
        const winRate = player.games_played > 0
          ? Math.round((player.wins / player.games_played) * 100)
          : 0;
        return (
          <div
            key={player.user_id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-colors",
              idx === 0 ? "bg-secondary/10 border-secondary/30" : "bg-muted/30 border-border"
            )}
          >
            {/* Rank */}
            <div className="w-6 flex justify-center flex-shrink-0">
              {idx < 3 ? RANK_ICONS[idx] : (
                <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
              )}
            </div>

            {/* Avatar */}
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={player.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">
                {(player.display_name ?? player.username ?? "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Name + stats */}
            <div className="flex-1 min-w-0">
              <Link
                to={profileUrl(player.username)}
                className="font-medium text-sm hover:text-primary transition-colors truncate block"
              >
                {player.display_name ?? player.username}
              </Link>
              <div className="text-xs text-muted-foreground">
                {player.games_played}G · {player.wins}W · {winRate}% WR
              </div>
            </div>

            {/* ELO + tier */}
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-bold font-mono">{player.elo}</div>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", tier.className)}>
                {tier.label}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
