import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Weight, Plus, Loader2, BookOpen } from "lucide-react";
import type { CatalogGameItem } from "./CatalogGameGrid";
import { decodeHtmlEntities } from "@/lib/utils";

interface CatalogGameListProps {
  games: CatalogGameItem[];
  isAuthenticated: boolean;
  addingId?: string;
  isPending: boolean;
  onAdd?: (gameId: string) => void;
}

export function CatalogGameList({ games, isAuthenticated, addingId, isPending, onAdd }: CatalogGameListProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
      {/* Header row - hidden on mobile */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_80px_80px_70px_60px_60px_60px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
        <span>Title</span>
        <span className="text-center">Players</span>
        <span className="text-center">Time</span>
        <span className="text-center">Weight</span>
        <span className="text-center">BGG</span>
        <span className="text-center">GT</span>
        <span />
      </div>

      {games.map((game) => (
        <Link
          key={game.id}
          to={`/catalog/${game.slug || game.id}`}
          className="flex items-center sm:grid sm:grid-cols-[1fr_80px_80px_70px_60px_60px_60px] gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors group"
        >
          {/* Title + image */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {game.image_url ? (
              <img src={game.image_url} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" loading="lazy" />
            ) : (
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{decodeHtmlEntities(game.title)}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {game.designers.slice(0, 2).join(", ")}{game.designers.length > 2 ? ` +${game.designers.length - 2}` : ""}
                {game.year_published ? ` · ${game.year_published}` : ""}
              </p>
            </div>
          </div>

          {/* Mobile badges */}
          <div className="flex items-center gap-1.5 sm:hidden flex-shrink-0">
            {game.bgg_community_rating != null && game.bgg_community_rating > 0 && (
              <Badge variant="secondary" className="text-[10px]">★ {game.bgg_community_rating.toFixed(1)}</Badge>
            )}
          </div>

          {/* Desktop columns */}
          <span className="hidden sm:block text-center text-xs text-muted-foreground">
            {game.min_players != null && game.max_players != null ? `${game.min_players}–${game.max_players}` : "—"}
          </span>
          <span className="hidden sm:block text-center text-xs text-muted-foreground">
            {game.play_time_minutes != null ? `${game.play_time_minutes}m` : "—"}
          </span>
          <span className="hidden sm:block text-center text-xs text-muted-foreground">
            {game.weight != null ? game.weight.toFixed(1) : "—"}
          </span>
          <span className="hidden sm:block text-center text-xs text-muted-foreground">
            {game.bgg_community_rating != null && game.bgg_community_rating > 0 ? `★ ${game.bgg_community_rating.toFixed(1)}` : "—"}
          </span>
          <span className="hidden sm:block text-center text-xs text-muted-foreground">
            {game.community_rating != null ? `★ ${game.community_rating.toFixed(1)}` : "—"}
          </span>

          {/* Add button */}
          <div className="flex-shrink-0" onClick={(e) => e.preventDefault()}>
            {isAuthenticated && onAdd && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Add to my library"
                disabled={isPending && addingId === game.id}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(game.id); }}
              >
                {isPending && addingId === game.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
