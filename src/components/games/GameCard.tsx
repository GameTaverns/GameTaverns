import { Link } from "react-router-dom";
import { Users, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GameWithRelations } from "@/types/game";
import { cn, proxiedImageUrl } from "@/lib/utils";

interface GameCardProps {
  game: GameWithRelations;
}

export function GameCard({ game }: GameCardProps) {
  const playerRange = game.min_players === game.max_players
    ? `${game.min_players}`
    : `${game.min_players}-${game.max_players}`;

  return (
    <Link to={`/game/${game.slug || game.id}`}>
      <Card className="group overflow-hidden card-elevated card-hover bg-card border-border">
        {/* Image */}
        <div className="aspect-square overflow-hidden bg-muted">
          {game.image_url ? (
            <>
              <img
                src={proxiedImageUrl(game.image_url)}
                alt={game.title}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
              <span className="sr-only">{game.title}</span>
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-muted">
              <span className="text-4xl text-muted-foreground/50">🎲</span>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          {/* Title */}
          <h3 className="font-display text-lg font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {game.title}
          </h3>

          {/* Quick Info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {playerRange}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {game.play_time.replace(' Minutes', 'm').replace(' Hours', 'h')}
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {game.is_coming_soon && (
              <Badge className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                Coming Soon
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {game.difficulty}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {game.game_type}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
