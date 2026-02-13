import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Clock, Weight, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhoHasThis } from "@/components/catalog/WhoHasThis";

interface CatalogGame {
  id: string;
  title: string;
  bgg_id: string | null;
  image_url: string | null;
  description: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time_minutes: number | null;
  weight: number | null;
  year_published: number | null;
  bgg_url: string | null;
  bgg_community_rating: number | null;
}

export function CatalogBrowseEmbed() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("title");
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const { data: catalogGames = [], isLoading } = useQuery({
    queryKey: ["catalog-browse-embed"],
    queryFn: async (): Promise<CatalogGame[]> => {
      const { data, error } = await supabase
        .from("game_catalog")
        .select("id, title, bgg_id, image_url, description, min_players, max_players, play_time_minutes, weight, year_published, bgg_url, bgg_community_rating")
        .eq("is_expansion", false)
        .order("title")
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const filtered = useMemo(() => {
    let results = catalogGames.filter(g => {
      if (searchTerm && !g.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
    results.sort((a, b) => {
      switch (sortBy) {
        case "rating": return (b.bgg_community_rating ?? 0) - (a.bgg_community_rating ?? 0);
        case "weight": return (a.weight ?? 3) - (b.weight ?? 3);
        case "year": return (b.year_published ?? 0) - (a.year_published ?? 0);
        default: return a.title.localeCompare(b.title);
      }
    });
    return results;
  }, [catalogGames, searchTerm, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search catalog..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title">A–Z</SelectItem>
            <SelectItem value="rating">Top Rated</SelectItem>
            <SelectItem value="weight">Lightest First</SelectItem>
            <SelectItem value="year">Newest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} games in catalog</p>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-36 bg-muted rounded-t-lg" />
              <CardContent className="pt-3 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((game) => (
            <Card
              key={game.id}
              className="overflow-hidden card-hover cursor-pointer group"
              onClick={() => setSelectedGame(selectedGame === game.id ? null : game.id)}
            >
              {game.image_url ? (
                <img src={game.image_url} alt={game.title} className="w-full h-36 object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-36 bg-muted flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <CardContent className="pt-3 space-y-2">
                <h3 className="font-display font-semibold text-sm truncate">{game.title}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {game.min_players != null && game.max_players != null && (
                    <Badge variant="outline" className="text-[10px]">
                      <Users className="h-3 w-3 mr-0.5" />{game.min_players}–{game.max_players}
                    </Badge>
                  )}
                  {game.play_time_minutes != null && (
                    <Badge variant="outline" className="text-[10px]">
                      <Clock className="h-3 w-3 mr-0.5" />{game.play_time_minutes}m
                    </Badge>
                  )}
                  {game.weight != null && (
                    <Badge variant="outline" className="text-[10px]">
                      <Weight className="h-3 w-3 mr-0.5" />{game.weight.toFixed(1)}
                    </Badge>
                  )}
                  {game.bgg_community_rating != null && game.bgg_community_rating > 0 && (
                    <Badge variant="secondary" className="text-[10px]">★ {game.bgg_community_rating.toFixed(1)}</Badge>
                  )}
                </div>
                {selectedGame === game.id && (
                  <div className="pt-2 border-t border-border space-y-3">
                    {game.description && <p className="text-xs text-muted-foreground line-clamp-4">{game.description}</p>}
                    <div className="flex gap-2">
                      {game.bgg_url && (
                        <a href={game.bgg_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="text-xs gap-1">
                            <ExternalLink className="h-3 w-3" /> BGG
                          </Button>
                        </a>
                      )}
                    </div>
                    <WhoHasThis catalogId={game.id} gameTitle={game.title} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-display text-xl mb-2">No games found</h3>
          <p className="text-muted-foreground">Try adjusting your search</p>
        </div>
      )}
    </div>
  );
}
