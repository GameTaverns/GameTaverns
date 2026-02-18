import { Flame, TrendingUp, BookOpen, Heart, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHotness, type HotGame } from "@/hooks/useHotness";
import { Link } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { cn } from "@/lib/utils";
import { GameImage } from "./GameImage";

interface HotnessLeaderboardProps {
  libraryId?: string | null;
  tenantSlug?: string | null;
  limit?: number;
  compact?: boolean;
}

function HeatBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0;
  return (
    <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ScorePill({ icon: Icon, count, label }: { icon: React.ElementType; count: number; label: string }) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title={label}>
      <Icon className="h-2.5 w-2.5" />
      {count}
    </span>
  );
}

export function HotnessLeaderboard({ libraryId, tenantSlug: tenantSlugProp, limit = 10, compact = false }: HotnessLeaderboardProps) {
  const { tenantSlug: tenantSlugCtx } = useTenant();
  const tenantSlug = tenantSlugProp ?? tenantSlugCtx;
  const { data: games = [], isLoading } = useHotness(libraryId, limit);

  const gameUrl = (slug: string | null) => {
    const path = `/game/${slug}`;
    return tenantSlug ? getLibraryUrl(tenantSlug, path) : path;
  };

  const maxScore = games[0]?.hotness_score ?? 1;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(compact ? 5 : 8)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Flame className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No trending games yet.</p>
        <p className="text-xs mt-1">Log sessions, add to wishlists, and rate games to build the chart.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {games.map((game, idx) => (
        <HotnessRow
          key={game.game_id}
          game={game}
          rank={idx + 1}
          maxScore={maxScore}
          gameUrl={gameUrl(game.slug)}
          compact={compact}
        />
      ))}
    </div>
  );
}

function HotnessRow({
  game,
  rank,
  maxScore,
  gameUrl,
  compact,
}: {
  game: HotGame;
  rank: number;
  maxScore: number;
  gameUrl: string;
  compact: boolean;
}) {
  const isTop3 = rank <= 3;

  return (
    <Link
      to={gameUrl}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg border transition-colors hover:bg-muted/50",
        rank === 1 && "bg-orange-500/5 border-orange-500/30",
        rank === 2 && "bg-muted/30 border-border",
        rank >= 3 && "bg-muted/20 border-border"
      )}
    >
      {/* Rank */}
      <div className="w-7 flex-shrink-0 text-center">
        {rank === 1 ? (
          <Flame className="h-4 w-4 text-orange-500 mx-auto" />
        ) : rank === 2 ? (
          <TrendingUp className="h-4 w-4 text-muted-foreground mx-auto" />
        ) : (
          <span className="text-xs text-muted-foreground font-mono">#{rank}</span>
        )}
      </div>

      {/* Thumbnail */}
      {!compact && (
        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-muted">
          {game.image_url ? (
            <GameImage imageUrl={game.image_url} alt={game.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-muted-foreground/40" />
            </div>
          )}
        </div>
      )}

      {/* Name + signals */}
      <div className="flex-1 min-w-0">
        <div className={cn("font-medium truncate", isTop3 ? "text-sm" : "text-xs")}>
          {game.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <HeatBar score={game.hotness_score} max={maxScore} />
          <div className="flex items-center gap-1.5">
            <ScorePill icon={BookOpen} count={game.recent_plays} label="Recent plays" />
            <ScorePill icon={Heart} count={game.recent_wishes} label="Wishlist adds" />
            <ScorePill icon={Star} count={game.recent_ratings} label="Ratings" />
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <span className={cn("font-bold font-mono text-sm", rank === 1 ? "text-orange-500" : "text-foreground")}>
          {game.hotness_score}
        </span>
        <div className="text-[10px] text-muted-foreground">pts</div>
      </div>
    </Link>
  );
}
