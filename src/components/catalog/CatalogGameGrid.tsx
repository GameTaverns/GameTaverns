import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, Weight, BookOpen, PenTool, Plus, Loader2 } from "lucide-react";
import { decodeHtmlEntities } from "@/lib/utils";

export interface CatalogGameItem {
  id: string;
  title: string;
  slug: string | null;
  image_url: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time_minutes: number | null;
  weight: number | null;
  year_published: number | null;
  bgg_community_rating: number | null;
  designers: string[];
  community_rating: number | null;
  community_rating_count: number;
}

interface CatalogGameGridProps {
  games: CatalogGameItem[];
  isAuthenticated: boolean;
  addingId?: string;
  isPending: boolean;
  onAdd?: (gameId: string) => void;
}

export function CatalogGameGrid({ games, isAuthenticated, addingId, isPending, onAdd }: CatalogGameGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
      {games.map((game) => (
        <div key={game.id} className="relative group flex flex-col">
          <Link to={`/catalog/${game.slug || game.id}`} className="flex-1 flex flex-col">
            <Card className="group overflow-hidden card-elevated card-hover bg-card border-border flex-1 flex flex-col">
              {/* Image - match library GameCard aspect ratios */}
              <div className="relative aspect-[3/4] sm:aspect-square overflow-hidden bg-gradient-to-b from-muted/50 to-muted flex items-center justify-center">
                {game.image_url ? (
                  <img src={game.image_url} alt={decodeHtmlEntities(game.title)} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <span className="text-4xl text-muted-foreground/50">🎲</span>
                  </div>
                )}
              </div>

              <CardContent className="p-1.5 sm:p-4 flex-1 flex flex-col">
                {/* Title - fixed height for uniform cards, matching library */}
                <h3 className="font-display text-xs sm:text-lg font-semibold text-foreground line-clamp-2 min-h-[2rem] sm:min-h-[3.5rem] mb-1 sm:mb-3 group-hover:text-primary transition-colors">
                  {decodeHtmlEntities(game.title)}
                </h3>

                <hr className="border-border mb-1 sm:mb-3" />

                {/* Quick Info - matching library card layout */}
                <div className="flex items-center gap-1.5 sm:gap-4 text-[10px] sm:text-sm text-muted-foreground mb-1 sm:mb-3">
                  {game.min_players != null && game.max_players != null && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                      {game.min_players === game.max_players ? `${game.min_players}` : `${game.min_players}-${game.max_players}`}
                    </span>
                  )}
                  {game.play_time_minutes != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                      {game.play_time_minutes}m
                    </span>
                  )}
                </div>

                <hr className="border-border mb-1 sm:mb-3" />

                {/* Tags - hidden on mobile for compactness, matching library */}
                <div className="hidden sm:flex flex-wrap gap-1.5 mt-auto">
                  {game.weight != null && (
                    <Badge variant="outline" className="text-xs">
                      <Weight className="h-3 w-3 mr-0.5" />{game.weight.toFixed(1)}
                    </Badge>
                  )}
                  {game.bgg_community_rating != null && game.bgg_community_rating > 0 && (
                    <Badge variant="secondary" className="text-xs">BGG ★ {game.bgg_community_rating.toFixed(1)}</Badge>
                  )}
                  {game.community_rating != null && (
                    <Badge className="text-xs bg-primary/20 text-primary border-primary/30">★ {game.community_rating.toFixed(1)} ({game.community_rating_count})</Badge>
                  )}
                  {game.designers.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <PenTool className="h-3 w-3 mr-0.5" />
                      {game.designers[0]}{game.designers.length > 1 ? ` +${game.designers.length - 1}` : ""}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Add button - outside Link to prevent click conflicts */}
          {isAuthenticated && onAdd && (
            <div className="absolute top-2 right-2 z-10">
              <Button
                variant="ghost"
                size="icon"
                className="bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm h-8 w-8"
                title="Add to my library"
                disabled={isPending && addingId === game.id}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(game.id); }}
              >
                {isPending && addingId === game.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
