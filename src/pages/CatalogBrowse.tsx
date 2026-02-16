import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/backend/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Clock, Weight, BookOpen, ExternalLink, ChevronDown, ChevronUp, ArrowLeft, Palette, PenTool } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { WhoHasThis } from "@/components/catalog/WhoHasThis";

interface CatalogGame {
  id: string;
  title: string;
  slug: string | null;
  bgg_id: string | null;
  image_url: string | null;
  description: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time_minutes: number | null;
  weight: number | null;
  year_published: number | null;
  is_expansion: boolean;
  bgg_url: string | null;
  bgg_community_rating: number | null;
  suggested_age: string | null;
  designers: string[];
  artists: string[];
}

export default function CatalogBrowse() {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [playerCount, setPlayerCount] = useState<number[]>([4]);
  const [maxTime, setMaxTime] = useState<number[]>([240]);
  const [weightRange, setWeightRange] = useState<number[]>([1, 5]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("title");

  const sidebarFilter = searchParams.get("filter");
  const sidebarValue = searchParams.get("value");

  const { data: catalogGames = [], isLoading } = useQuery({
    queryKey: ["catalog-browse"],
    queryFn: async (): Promise<CatalogGame[]> => {
      const { data, error } = await supabase
        .from("game_catalog")
        .select("id, title, slug, bgg_id, image_url, description, min_players, max_players, play_time_minutes, weight, year_published, is_expansion, bgg_url, bgg_community_rating, suggested_age")
        .eq("is_expansion", false)
        .order("title")
        .limit(1000);

      if (error) throw error;

      // Fetch all catalog designers and artists in bulk
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

  // Build unique designer/artist lists for filter dropdowns
  const allDesigners = useMemo(() => {
    const set = new Set<string>();
    catalogGames.forEach(g => g.designers.forEach(d => set.add(d)));
    return [...set].sort();
  }, [catalogGames]);

  const allArtists = useMemo(() => {
    const set = new Set<string>();
    catalogGames.forEach(g => g.artists.forEach(a => set.add(a)));
    return [...set].sort();
  }, [catalogGames]);

  const filtered = useMemo(() => {
    let results = catalogGames.filter(g => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = g.title.toLowerCase().includes(term);
        const matchDesigner = g.designers.some(d => d.toLowerCase().includes(term));
        const matchArtist = g.artists.some(a => a.toLowerCase().includes(term));
        if (!matchTitle && !matchDesigner && !matchArtist) return false;
      }
      
      // Apply sidebar filters
      if (sidebarFilter && sidebarValue) {
        switch (sidebarFilter) {
          case "letter":
            if (sidebarValue === "#") {
              if (/^[A-Za-z]/.test(g.title)) return false;
            } else if (!g.title.toUpperCase().startsWith(sidebarValue)) return false;
            break;
          case "players": {
            const match = sidebarValue.match(/(\d+)/);
            if (match) {
              const count = parseInt(match[1]);
              if (sidebarValue.includes("+")) {
                if (g.max_players && g.max_players < count) return false;
              } else if (sidebarValue.includes("-")) {
                const rangeMatch = sidebarValue.match(/(\d+)-(\d+)/);
                if (rangeMatch) {
                  const lo = parseInt(rangeMatch[1]);
                  const hi = parseInt(rangeMatch[2]);
                  if (g.min_players && g.min_players > hi) return false;
                  if (g.max_players && g.max_players < lo) return false;
                }
              } else {
                if (g.min_players && count < g.min_players) return false;
                if (g.max_players && count > g.max_players) return false;
              }
            }
            break;
          }
          case "difficulty": {
            const weightMap: Record<string, [number, number]> = {
              "1 - Light": [0, 1.5],
              "2 - Medium Light": [1.5, 2.25],
              "3 - Medium": [2.25, 3.0],
              "4 - Medium Heavy": [3.0, 3.75],
              "5 - Heavy": [3.75, 5.0],
            };
            const range = weightMap[sidebarValue];
            if (range && g.weight != null) {
              if (g.weight < range[0] || g.weight > range[1]) return false;
            }
            break;
          }
          case "playtime": {
            const timeMap: Record<string, number> = {
              "0-15 Minutes": 15, "15-30 Minutes": 30, "30-45 Minutes": 45,
              "45-60 Minutes": 60, "60+ Minutes": 90, "2+ Hours": 150, "3+ Hours": 210,
            };
            const maxMin = timeMap[sidebarValue];
            if (maxMin && g.play_time_minutes) {
              if (sidebarValue.includes("+")) {
                if (g.play_time_minutes < maxMin * 0.6) return false;
              } else if (g.play_time_minutes > maxMin) return false;
            }
            break;
          }
          case "designer":
            if (!g.designers.some(d => d === sidebarValue)) return false;
            break;
          case "artist":
            if (!g.artists.some(a => a === sidebarValue)) return false;
            break;
        }
      }

      if (showFilters) {
        const count = playerCount[0];
        if (g.min_players && count < g.min_players) return false;
        if (g.max_players && count > g.max_players) return false;
        if (g.play_time_minutes && g.play_time_minutes > maxTime[0]) return false;
        if (g.weight) {
          if (g.weight < weightRange[0] || g.weight > weightRange[1]) return false;
        }
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
  }, [catalogGames, searchTerm, playerCount, maxTime, weightRange, showFilters, sortBy, sidebarFilter, sidebarValue]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">Game Catalog</h1>
          <p className="text-muted-foreground text-lg">
            Browse {catalogGames.length} games across the platform
          </p>
        </div>

        {/* Active filter indicator */}
        {sidebarFilter && sidebarValue && (
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              {sidebarFilter === "designer" && <PenTool className="h-3 w-3" />}
              {sidebarFilter === "artist" && <Palette className="h-3 w-3" />}
              {sidebarFilter}: {sidebarValue}
            </Badge>
            <Link to="/catalog">
              <Button variant="ghost" size="sm" className="text-xs">Clear filter</Button>
            </Link>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="space-y-4 mb-8">
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
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Filters
            </Button>
          </div>

          {showFilters && (
            <Card>
              <CardContent className="pt-4 grid sm:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4" /> Players: {playerCount[0]}
                  </Label>
                  <Slider value={playerCount} onValueChange={setPlayerCount} min={1} max={10} step={1} />
                </div>
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4" /> Max Time: {maxTime[0]} min
                  </Label>
                  <Slider value={maxTime} onValueChange={setMaxTime} min={15} max={240} step={15} />
                </div>
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Weight className="h-4 w-4" /> Complexity: {weightRange[0].toFixed(1)} – {weightRange[1].toFixed(1)}
                  </Label>
                  <Slider value={weightRange} onValueChange={setWeightRange} min={1} max={5} step={0.5} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">{filtered.length} games found</p>

        {/* Game Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-40 bg-muted rounded-t-lg" />
                <CardContent className="pt-3 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((game) => (
              <Card
                key={game.id}
                className="overflow-hidden card-hover cursor-pointer group"
                onClick={() => setSelectedGame(selectedGame === game.id ? null : game.id)}
              >
                {game.image_url ? (
                  <img
                    src={game.image_url}
                    alt={game.title}
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <CardContent className="pt-3 space-y-2">
                  <h3 className="font-display font-semibold text-sm truncate">{game.title}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {game.min_players != null && game.max_players != null && (
                      <Badge variant="outline" className="text-[10px]">
                        <Users className="h-3 w-3 mr-0.5" />
                        {game.min_players}–{game.max_players}
                      </Badge>
                    )}
                    {game.play_time_minutes != null && (
                      <Badge variant="outline" className="text-[10px]">
                        <Clock className="h-3 w-3 mr-0.5" />
                        {game.play_time_minutes}m
                      </Badge>
                    )}
                    {game.weight != null && (
                      <Badge variant="outline" className="text-[10px]">
                        <Weight className="h-3 w-3 mr-0.5" />
                        {game.weight.toFixed(1)}
                      </Badge>
                    )}
                    {game.bgg_community_rating != null && game.bgg_community_rating > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        ★ {game.bgg_community_rating.toFixed(1)}
                      </Badge>
                    )}
                  </div>

                  {/* Designer/Artist preview */}
                  {game.designers.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      <PenTool className="h-2.5 w-2.5 inline mr-0.5" />
                      {game.designers.slice(0, 2).join(", ")}{game.designers.length > 2 ? ` +${game.designers.length - 2}` : ""}
                    </p>
                  )}

                  {game.year_published && (
                    <p className="text-xs text-muted-foreground">{game.year_published}</p>
                  )}

                  {/* Expanded details */}
                  {selectedGame === game.id && (
                    <div className="pt-2 border-t border-border space-y-3">
                      {game.description && (
                        <p className="text-xs text-muted-foreground line-clamp-4">{game.description}</p>
                      )}
                      {game.designers.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-foreground flex items-center gap-1">
                            <PenTool className="h-3 w-3" /> Designer{game.designers.length > 1 ? "s" : ""}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {game.designers.map(d => (
                              <Link key={d} to={`/catalog?filter=designer&value=${encodeURIComponent(d)}`} onClick={e => e.stopPropagation()}>
                                <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-accent">{d}</Badge>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {game.artists.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-foreground flex items-center gap-1">
                            <Palette className="h-3 w-3" /> Artist{game.artists.length > 1 ? "s" : ""}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {game.artists.map(a => (
                              <Link key={a} to={`/catalog?filter=artist&value=${encodeURIComponent(a)}`} onClick={e => e.stopPropagation()}>
                                <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-accent">{a}</Badge>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {game.bgg_url && (
                          <a href={game.bgg_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                            <Button variant="outline" size="sm" className="text-xs gap-1">
                              <ExternalLink className="h-3 w-3" /> BGG
                            </Button>
                          </a>
                        )}
                      </div>
                      {/* Who Has This */}
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
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
