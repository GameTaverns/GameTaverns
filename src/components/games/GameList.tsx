import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, DollarSign, BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameImage } from "./GameImage";
import { StarRating } from "./StarRating";
import { useDemoMode } from "@/contexts/DemoContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import type { GameWithRelations } from "@/types/game";

interface GameListProps {
  games: GameWithRelations[];
  hasActiveFilters?: boolean;
}

export function GameList({ games, hasActiveFilters }: GameListProps) {
  const { isDemoMode } = useDemoMode();
  const { forSale, comingSoon } = useFeatureFlags();
  const { buildUrl } = useTenantUrl();

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
          <BookOpen className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          {hasActiveFilters ? "No matching games" : "No games yet"}
        </h3>
        <p className="text-muted-foreground text-sm max-w-md">
          {hasActiveFilters
            ? "Try clearing some filters or searching with different terms."
            : "This library doesn't have any games yet."}
        </p>
        {!hasActiveFilters && (
          <Link to="/catalog" className="mt-4">
            <Button variant="outline" size="sm" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Browse Catalog
              <Plus className="h-3 w-3 text-primary" />
            </Button>
          </Link>
        )}
      </div>
    );
  }

  const basePath = isDemoMode ? "/demo/game" : "/game";

  return (
    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
      {/* Header row - hidden on mobile */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_80px_80px_70px_80px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
        <span>Title</span>
        <span className="text-center">Players</span>
        <span className="text-center">Time</span>
        <span className="text-center">Difficulty</span>
        <span className="text-center">Rating</span>
      </div>

      {games.map((game) => {
        const gameUrl = buildUrl(`${basePath}/${game.slug || game.id}`);
        const playerRange = game.min_players === game.max_players
          ? `${game.min_players}`
          : `${game.min_players}-${game.max_players}`;

        return (
          <Link
            key={game.id}
            to={gameUrl}
            className="flex items-center sm:grid sm:grid-cols-[1fr_80px_80px_70px_80px] gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors group"
          >
            {/* Title + image */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {game.image_url ? (
                <GameImage
                  imageUrl={game.image_url}
                  alt={game.title}
                  loading="lazy"
                  className="h-10 w-10 rounded object-cover flex-shrink-0"
                  fallback={
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">🎲</span>
                    </div>
                  }
                />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🎲</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {game.title}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  {game.game_type && <span>{game.game_type}</span>}
                  {forSale && game.is_for_sale && (
                    <Badge className="text-[9px] px-1 py-0 bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
                      <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                      {game.sale_price ? `$${game.sale_price}` : 'Sale'}
                    </Badge>
                  )}
                  {comingSoon && game.is_coming_soon && (
                    <Badge className="text-[9px] px-1 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                      Soon
                    </Badge>
                  )}
                  {(game as any).ownership_status === "played_only" && (
                    <Badge className="text-[9px] px-1 py-0 bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                      Played Only
                    </Badge>
                  )}
                  {(game as any).ownership_status === "previously_owned" && (
                    <Badge className="text-[9px] px-1 py-0 bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30">
                      Prev. Owned
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile badges */}
            <div className="flex items-center gap-1.5 sm:hidden flex-shrink-0">
              <StarRating gameId={game.id} size="sm" showCount={false} interactive={false} />
            </div>

            {/* Desktop columns */}
            <span className="hidden sm:flex items-center justify-center text-xs text-muted-foreground">
              <Users className="h-3 w-3 mr-1" />
              {playerRange}
            </span>
            <span className="hidden sm:block text-center text-xs text-muted-foreground">
              {game.play_time?.replace(' Minutes', 'm').replace(' Hours', 'h') || "—"}
            </span>
            <span className="hidden sm:block text-center text-xs text-muted-foreground">
              {game.difficulty?.replace(/^\d+ - /, '') || "—"}
            </span>
            <span className="hidden sm:flex items-center justify-center">
              <StarRating gameId={game.id} size="sm" showCount={false} interactive={false} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
