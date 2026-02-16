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
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {games.map((game) => (
        <div key={game.id} className="relative group">
          <Link to={`/catalog/${game.slug || game.id}`} className="block">
            <Card className="overflow-hidden card-hover cursor-pointer h-full">
              {game.image_url ? (
                <img src={game.image_url} alt={decodeHtmlEntities(game.title)} className="w-full h-40 object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-40 bg-muted flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <CardContent className="pt-3 space-y-2">
                <h3 className="font-display font-semibold text-sm truncate group-hover:text-primary transition-colors">{decodeHtmlEntities(game.title)}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {game.min_players != null && game.max_players != null && (
                    <Badge variant="outline" className="text-[10px]"><Users className="h-3 w-3 mr-0.5" />{game.min_players}–{game.max_players}</Badge>
                  )}
                  {game.play_time_minutes != null && (
                    <Badge variant="outline" className="text-[10px]"><Clock className="h-3 w-3 mr-0.5" />{game.play_time_minutes}m</Badge>
                  )}
                  {game.weight != null && (
                    <Badge variant="outline" className="text-[10px]"><Weight className="h-3 w-3 mr-0.5" />{game.weight.toFixed(1)}</Badge>
                  )}
                  {game.bgg_community_rating != null && game.bgg_community_rating > 0 && (
                    <Badge variant="secondary" className="text-[10px]">BGG ★ {game.bgg_community_rating.toFixed(1)}</Badge>
                  )}
                  {game.community_rating != null && (
                    <Badge variant="default" className="text-[10px]">★ {game.community_rating.toFixed(1)} ({game.community_rating_count})</Badge>
                  )}
                </div>
                {game.designers.length > 0 && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    <PenTool className="h-2.5 w-2.5 inline mr-0.5" />
                    {game.designers.slice(0, 2).join(", ")}{game.designers.length > 2 ? ` +${game.designers.length - 2}` : ""}
                  </p>
                )}
                {game.year_published && (
                  <p className="text-xs text-muted-foreground">{game.year_published}</p>
                )}
              </CardContent>
            </Card>
          </Link>

          {isAuthenticated && onAdd && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm h-8 w-8"
              title="Add to my library"
              disabled={isPending && addingId === game.id}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(game.id); }}
            >
              {isPending && addingId === game.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
