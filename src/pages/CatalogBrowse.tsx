import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/backend/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Clock, Weight, BookOpen, ChevronDown, ChevronUp, Menu, LayoutGrid, List } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { useAddFromCatalog } from "@/hooks/useAddFromCatalog";
import { CatalogSidebar } from "@/components/catalog/CatalogSidebar";
import { CatalogGameGrid } from "@/components/catalog/CatalogGameGrid";
import { CatalogGameList } from "@/components/catalog/CatalogGameList";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";

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
  mechanics: string[];
  publishers: string[];
  community_rating: number | null;
  community_rating_count: number;
}

export default function CatalogBrowse() {
  const { isAuthenticated } = useAuth();
  const { data: myLibrary } = useMyLibrary();
  const addFromCatalog = useAddFromCatalog();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [playerCount, setPlayerCount] = useState<number[]>([4]);
  const [maxTime, setMaxTime] = useState<number[]>([240]);
  const [weightRange, setWeightRange] = useState<number[]>([1, 5]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>("title");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = viewMode === "list" ? 50 : 24;

  const sidebarFilter = searchParams.get("filter");
  const sidebarValue = searchParams.get("value");

  const { data: catalogGames = [], isLoading } = useQuery({
    queryKey: ["catalog-browse"],
    queryFn: async (): Promise<CatalogGame[]> => {
      // Fetch all games using pagination to avoid the 1000-row limit
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch, error } = await supabase
          .from("game_catalog")
          .select("id, title, slug, bgg_id, image_url, description, min_players, max_players, play_time_minutes, weight, year_published, is_expansion, bgg_url, bgg_community_rating, suggested_age")
          .order("title")
          .range(from, from + batchSize - 1);
        if (error) throw error;
        allData = allData.concat(batch || []);
        if (!batch || batch.length < batchSize) break;
        from += batchSize;
      }

      const data = allData;

      const catalogIds = (data || []).map(g => g.id);

      const [designersRes, artistsRes, mechanicsRes, publishersRes] = await Promise.all([
        supabase.from("catalog_designers").select("catalog_id, designer:designers(name)").in("catalog_id", catalogIds),
        supabase.from("catalog_artists").select("catalog_id, artist:artists(name)").in("catalog_id", catalogIds),
        supabase.from("catalog_mechanics").select("catalog_id, mechanic:mechanics(name)").in("catalog_id", catalogIds),
        supabase.from("catalog_publishers").select("catalog_id, publisher:publishers(name)").in("catalog_id", catalogIds),
      ]);

      // Aggregate community ratings across all libraries
      // game_ratings -> game_id -> games.catalog_id
      const { data: ratingsData } = await supabase
        .from("games")
        .select("catalog_id, game_ratings(rating)")
        .in("catalog_id", catalogIds)
        .not("catalog_id", "is", null);

      const ratingMap = new Map<string, { sum: number; count: number }>();
      for (const game of ratingsData || []) {
        if (!game.catalog_id) continue;
        const ratings = (game as any).game_ratings as { rating: number }[] || [];
        for (const r of ratings) {
          const existing = ratingMap.get(game.catalog_id) || { sum: 0, count: 0 };
          existing.sum += r.rating;
          existing.count += 1;
          ratingMap.set(game.catalog_id, existing);
        }
      }

      const buildMap = (rows: any[], key: string) => {
        const map = new Map<string, string[]>();
        for (const row of rows) {
          const name = (row as any)[key]?.name;
          if (name) {
            const list = map.get(row.catalog_id) || [];
            list.push(name);
            map.set(row.catalog_id, list);
          }
        }
        return map;
      };

      const designerMap = buildMap(designersRes.data || [], "designer");
      const artistMap = buildMap(artistsRes.data || [], "artist");
      const mechanicMap = buildMap(mechanicsRes.data || [], "mechanic");
      const publisherMap = buildMap(publishersRes.data || [], "publisher");

      return (data || []).map(g => {
        const r = ratingMap.get(g.id);
        return {
          ...g,
          designers: designerMap.get(g.id) || [],
          artists: artistMap.get(g.id) || [],
          mechanics: mechanicMap.get(g.id) || [],
          publishers: publisherMap.get(g.id) || [],
          community_rating: r ? r.sum / r.count : null,
          community_rating_count: r?.count || 0,
        };
      });
    },
    staleTime: 1000 * 60 * 10,
  });

  // Build unique lists for filter dropdowns
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

  const allMechanics = useMemo(() => {
    const map = new Map<string, string>();
    catalogGames.forEach(g => g.mechanics.forEach(m => map.set(m, m)));
    return [...map.values()].sort().map(name => ({ id: name, name }));
  }, [catalogGames]);

  const allPublishers = useMemo(() => {
    const map = new Map<string, string>();
    catalogGames.forEach(g => g.publishers.forEach(p => map.set(p, p)));
    return [...map.values()].sort().map(name => ({ id: name, name }));
  }, [catalogGames]);

  // For "expansions" status filter, show expansions; otherwise hide them
  const filtered = useMemo(() => {
    const showExpansions = sidebarFilter === "status" && sidebarValue === "expansions";

    let results = catalogGames.filter(g => {
      if (!showExpansions && g.is_expansion) return false;
      if (showExpansions && !g.is_expansion) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = g.title.toLowerCase().includes(term);
        const matchDesigner = g.designers.some(d => d.toLowerCase().includes(term));
        const matchArtist = g.artists.some(a => a.toLowerCase().includes(term));
        if (!matchTitle && !matchDesigner && !matchArtist) return false;
      }
      
      if (sidebarFilter && sidebarValue) {
        switch (sidebarFilter) {
          case "status":
            if (sidebarValue === "top-rated") {
              if (!g.community_rating && !g.bgg_community_rating) return false;
            }
            break;
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
          case "mechanic":
            if (!g.mechanics.includes(sidebarValue)) return false;
            break;
          case "publisher":
            if (!g.publishers.includes(sidebarValue)) return false;
            break;
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
      if (sidebarFilter === "status" && sidebarValue === "top-rated") {
        const aRating = a.community_rating ?? a.bgg_community_rating ?? 0;
        const bRating = b.community_rating ?? b.bgg_community_rating ?? 0;
        return bRating - aRating;
      }
      switch (sortBy) {
        case "rating": return (b.bgg_community_rating ?? 0) - (a.bgg_community_rating ?? 0);
        case "community": return (b.community_rating ?? 0) - (a.community_rating ?? 0);
        case "weight": return (a.weight ?? 3) - (b.weight ?? 3);
        case "year": return (b.year_published ?? 0) - (a.year_published ?? 0);
        default: return a.title.localeCompare(b.title);
      }
    });

    return results;
  }, [catalogGames, searchTerm, playerCount, maxTime, weightRange, showFilters, sortBy, sidebarFilter, sidebarValue]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage, PAGE_SIZE]);

  // Reset page when filters change
  const handleSearchChange = (val: string) => { setSearchTerm(val); setCurrentPage(1); };
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleViewToggle = (mode: "grid" | "list") => {
    setViewMode(mode);
    setCurrentPage(1);
  };

  const handleAddGame = (gameId: string) => {
    addFromCatalog.mutate({ catalogId: gameId, libraryId: myLibrary?.id });
  };

  return (
    <Layout hideSidebar>
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-20 left-4 z-50 p-2 rounded-lg bg-sidebar-accent border border-sidebar-border"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <CatalogSidebar
        designers={allDesigners}
        artists={allArtists}
        mechanics={allMechanics}
        publishers={allPublishers}
        isOpen={sidebarOpen}
      />

      {/* Main content - offset by sidebar width */}
      <div className="lg:ml-72">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold">GameTaverns Library</h1>
            <p className="text-muted-foreground">
              {filtered.length} games in collection
            </p>
          </div>

          {/* Search & Sort Bar */}
          <div className="space-y-4 mb-8">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search games, designers, or artists..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="rating">BGG Rated</SelectItem>
                  <SelectItem value="community">Community Rated</SelectItem>
                  <SelectItem value="weight">Lightest First</SelectItem>
                  <SelectItem value="year">Newest First</SelectItem>
                </SelectContent>
              </Select>

              {/* View mode toggle */}
              <div className="flex border border-border rounded-md">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-r-none"
                  onClick={() => handleViewToggle("grid")}
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-l-none"
                  onClick={() => handleViewToggle("list")}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="hidden sm:inline">Filters</span>
              </Button>
            </div>

            {showFilters && (
              <Card>
                <CardContent className="pt-4 grid sm:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Users className="h-4 w-4" /> Players: {playerCount[0]}
                    </Label>
                    <Slider value={playerCount} onValueChange={(v) => { setPlayerCount(v); setCurrentPage(1); }} min={1} max={10} step={1} />
                  </div>
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4" /> Max Time: {maxTime[0]} min
                    </Label>
                    <Slider value={maxTime} onValueChange={(v) => { setMaxTime(v); setCurrentPage(1); }} min={15} max={240} step={15} />
                  </div>
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Weight className="h-4 w-4" /> Complexity: {weightRange[0].toFixed(1)} – {weightRange[1].toFixed(1)}
                    </Label>
                    <Slider value={weightRange} onValueChange={(v) => { setWeightRange(v); setCurrentPage(1); }} min={1} max={5} step={0.5} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Game display */}
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
          ) : viewMode === "grid" ? (
            <CatalogGameGrid
              games={paginatedGames}
              isAuthenticated={isAuthenticated}
              addingId={addFromCatalog.variables?.catalogId}
              isPending={addFromCatalog.isPending}
              onAdd={handleAddGame}
            />
          ) : (
            <CatalogGameList
              games={paginatedGames}
              isAuthenticated={isAuthenticated}
              addingId={addFromCatalog.variables?.catalogId}
              isPending={addFromCatalog.isPending}
              onAdd={handleAddGame}
            />
          )}

          {/* Pagination */}
          <CatalogPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />

          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-display text-xl mb-2">No games found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
