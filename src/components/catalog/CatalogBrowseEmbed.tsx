import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Clock, Weight, BookOpen, PenTool } from "lucide-react";

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
  designers: string[];
  artists: string[];
}

export function CatalogBrowseEmbed() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("title");
  

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

      const catalogIds = (data || []).map(g => g.id);

      const [designersRes, artistsRes] = await Promise.all([
        supabase
          .from("catalog_designers")
          .select("catalog_id, designer:designers(name)")
          .in("catalog_id", catalogIds),
        supabase
          .from("catalog_artists")
          .select("catalog_id, artist:artists(name)")
          .in("catalog_id", catalogIds),
      ]);

      const designerMap = new Map<string, string[]>();
      for (const row of designersRes.data || []) {
        const name = (row as any).designer?.name;
        if (name) {
          const list = designerMap.get(row.catalog_id) || [];
          list.push(name);
          designerMap.set(row.catalog_id, list);
        }
      }

      const artistMap = new Map<string, string[]>();
      for (const row of artistsRes.data || []) {
        const name = (row as any).artist?.name;
        if (name) {
          const list = artistMap.get(row.catalog_id) || [];
          list.push(name);
          artistMap.set(row.catalog_id, list);
        }
      }

      return (data || []).map(g => ({
        ...g,
        designers: designerMap.get(g.id) || [],
        artists: artistMap.get(g.id) || [],
      }));
    },
    staleTime: 1000 * 60 * 10,
  });

  const filtered = useMemo(() => {
    let results = catalogGames.filter(g => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return g.title.toLowerCase().includes(term) ||
          g.designers.some(d => d.toLowerCase().includes(term)) ||
          g.artists.some(a => a.toLowerCase().includes(term));
      }
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
            placeholder="Search games, designers, or artists..."
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
            <Link
              key={game.id}
              to={`/catalog/${game.id}`}
              className="group"
            >
            <Card
              className="overflow-hidden card-hover cursor-pointer h-full"
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
                {game.designers.length > 0 && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    <PenTool className="h-2.5 w-2.5 inline mr-0.5" />
                    {game.designers.slice(0, 2).join(", ")}{game.designers.length > 2 ? ` +${game.designers.length - 2}` : ""}
                  </p>
                )}
              </CardContent>
            </Card>
            </Link>
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
