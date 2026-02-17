import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Clock, Weight, BookOpen, PenTool, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 30;

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

// Debounce hook
function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Fetch designers + artists for a small set of catalog IDs
async function fetchJunctions(catalogIds: string[]) {
  if (catalogIds.length === 0) return { designerMap: new Map<string, string[]>(), artistMap: new Map<string, string[]>() };

  const [designersRes, artistsRes] = await Promise.all([
    supabase.from("catalog_designers").select("catalog_id, designer:designers(name)").in("catalog_id", catalogIds),
    supabase.from("catalog_artists").select("catalog_id, artist:artists(name)").in("catalog_id", catalogIds),
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

  return { designerMap, artistMap };
}

export function CatalogBrowseEmbed() {
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState("title");
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Reset page when search or sort changes
  useEffect(() => { setPage(0); }, [debouncedSearch, sortBy]);

  // Get total count for pagination
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["catalog-count", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("game_catalog")
        .select("id", { count: "exact", head: true })
        .eq("is_expansion", false);
      if (debouncedSearch) {
        query = query.ilike("title", `%${debouncedSearch}%`);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch current page of games
  const { data: catalogGames = [], isLoading } = useQuery({
    queryKey: ["catalog-browse", debouncedSearch, sortBy, page],
    queryFn: async (): Promise<CatalogGame[]> => {
      // Determine sort column + ascending
      let orderCol = "title";
      let ascending = true;
      switch (sortBy) {
        case "rating": orderCol = "bgg_community_rating"; ascending = false; break;
        case "weight": orderCol = "weight"; ascending = true; break;
        case "year": orderCol = "year_published"; ascending = false; break;
      }

      let query = supabase
        .from("game_catalog")
        .select("id, title, bgg_id, image_url, description, min_players, max_players, play_time_minutes, weight, year_published, bgg_url, bgg_community_rating")
        .eq("is_expansion", false)
        .order(orderCol, { ascending, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (debouncedSearch) {
        query = query.ilike("title", `%${debouncedSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const ids = (data || []).map(g => g.id);
      const { designerMap, artistMap } = await fetchJunctions(ids);

      return (data || []).map(g => ({
        ...g,
        designers: designerMap.get(g.id) || [],
        artists: artistMap.get(g.id) || [],
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Search + Sort */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search games by title..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{totalCount} games in catalog</p>
        <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</p>
      </div>

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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {catalogGames.map((game) => (
            <Link key={game.id} to={`/catalog/${game.id}`} className="group flex">
              <Card className="group overflow-hidden card-elevated card-hover bg-card border-border flex-1 flex flex-col">
                <div className="relative aspect-[3/4] sm:aspect-square overflow-hidden bg-gradient-to-b from-muted/50 to-muted flex items-center justify-center">
                  {game.image_url ? (
                    <img src={game.image_url} alt={game.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted">
                      <span className="text-4xl text-muted-foreground/50">🎲</span>
                    </div>
                  )}
                </div>
                <CardContent className="p-1.5 sm:p-4 flex-1 flex flex-col">
                  <h3 className="font-display text-xs sm:text-lg font-semibold text-foreground line-clamp-2 min-h-[2rem] sm:min-h-[3.5rem] mb-1 sm:mb-3 group-hover:text-primary transition-colors">{game.title}</h3>
                  <hr className="border-border mb-1 sm:mb-3" />
                  <div className="flex items-center gap-1.5 sm:gap-4 text-[10px] sm:text-sm text-muted-foreground mb-1 sm:mb-3">
                    {game.min_players != null && game.max_players != null && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                        {game.min_players}–{game.max_players}
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
                  <div className="hidden sm:flex flex-wrap gap-1.5 mt-auto">
                    {game.weight != null && (
                      <Badge variant="outline" className="text-xs">
                        <Weight className="h-3 w-3 mr-0.5" />{game.weight.toFixed(1)}
                      </Badge>
                    )}
                    {game.bgg_community_rating != null && game.bgg_community_rating > 0 && (
                      <Badge variant="secondary" className="text-xs">★ {game.bgg_community_rating.toFixed(1)}</Badge>
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
          ))}
        </div>
      )}

      {catalogGames.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-display text-xl mb-2">No games found</h3>
          <p className="text-muted-foreground">Try adjusting your search</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
