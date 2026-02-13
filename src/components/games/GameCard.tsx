import { Link } from "react-router-dom";
import { Users, Clock, DollarSign, Youtube, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExpansionList } from "./ExpansionList";
import { WishlistButton } from "./WishlistButton";
import { FavoriteButton } from "./FavoriteButton";
import { StarRating } from "./StarRating";
import { GameImage } from "./GameImage";
import { useDemoMode } from "@/contexts/DemoContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import type { GameWithRelations } from "@/types/game";
import { cn } from "@/lib/utils";

interface GameCardProps {
  game: GameWithRelations;
  priority?: boolean;
}

export function GameCard({ game, priority = false }: GameCardProps) {
  const { isDemoMode } = useDemoMode();
  const { wishlist, forSale, comingSoon } = useFeatureFlags();
  const { buildUrl } = useTenantUrl();
  
  const playerRange = game.min_players === game.max_players
    ? `${game.min_players}`
    : `${game.min_players}-${game.max_players}`;

  const hasExpansions = game.expansions && game.expansions.length > 0;

  const basePath = isDemoMode ? "/demo/game" : "/game";
  const gameUrl = buildUrl(`${basePath}/${game.slug || game.id}`);

  return (
    <div>
      <div className="relative">
        <Link to={gameUrl}>
          <Card className="group overflow-hidden card-elevated card-hover bg-card border-border">
            {/* Image - consistent square aspect ratio for uniform grid */}
            <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-muted/50 to-muted flex items-center justify-center">
              {game.image_url ? (
                <GameImage
                  imageUrl={game.image_url}
                  alt={game.title}
                  loading={priority ? "eager" : "lazy"}
                  priority={priority}
                  className="h-full w-full object-cover"
                  fallback={
                    <div className="flex h-full items-center justify-center bg-muted">
                      <span className="text-4xl text-muted-foreground/50">🎲</span>
                    </div>
                  }
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-muted">
                  <span className="text-4xl text-muted-foreground/50">🎲</span>
                </div>
              )}
            </div>

            <CardContent className="p-4">
              {/* Title - fixed height for uniform cards */}
              <h3 className="font-display text-lg font-semibold text-foreground line-clamp-2 min-h-[3.5rem] mb-3 group-hover:text-primary transition-colors">
                {game.title}
              </h3>

              <hr className="border-border mb-3" />

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

              {/* Rating */}
              <StarRating gameId={game.id} size="sm" showCount={true} interactive={false} />

              <hr className="border-border mb-3" />

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {(game as any).copies_owned > 1 && (
                  <Badge className="text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                    <Copy className="h-3 w-3 mr-0.5" />
                    {(game as any).copies_owned} copies
                  </Badge>
                )}
                {forSale && game.is_for_sale && (
                  <Badge className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
                    <DollarSign className="h-3 w-3 mr-0.5" />
                    {game.sale_price ? `$${game.sale_price}` : 'For Sale'}
                  </Badge>
                )}
                {comingSoon && game.is_coming_soon && (
                  <Badge className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                    Coming Soon
                  </Badge>
                )}
                {game.youtube_videos && game.youtube_videos.length > 0 && (
                  <Badge className="text-xs bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30">
                    <Youtube className="h-3 w-3 mr-0.5" />
                    {game.youtube_videos.length} Video{game.youtube_videos.length > 1 ? 's' : ''}
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

        {/* Action Buttons - Outside Link to prevent click conflicts */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {/* Favorite Button - only visible to library owners */}
          <FavoriteButton 
            gameId={game.id} 
            size="sm"
            className="bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm h-8 w-8" 
          />
          {/* Wishlist Button */}
          {wishlist && (
            <WishlistButton 
              gameId={game.id} 
              className="bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm h-8 w-8" 
            />
          )}
        </div>
      </div>

      {/* Expansions nested under the card */}
      {hasExpansions && (
        <ExpansionList expansions={game.expansions!} parentTitle={game.title} />
      )}
    </div>
  );
}
