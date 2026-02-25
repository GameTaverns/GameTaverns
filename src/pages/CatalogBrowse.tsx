import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/backend/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Clock, Weight, BookOpen, ChevronDown, ChevronUp, Menu, LayoutGrid, List, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries } from "@/hooks/useLibrary";
import { useAddFromCatalog } from "@/hooks/useAddFromCatalog";
import { CatalogSidebar } from "@/components/catalog/CatalogSidebar";
import { CatalogGameGrid, type CatalogGameItem } from "@/components/catalog/CatalogGameGrid";
import { CatalogGameList } from "@/components/catalog/CatalogGameList";
import { LibraryPickerDialog } from "@/components/catalog/LibraryPickerDialog";
import { useAddWant } from "@/hooks/useTrades";
import { useToast } from "@/hooks/use-toast";

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

const PAGE_SIZE = 30;

export default function CatalogBrowse() {
  const { isAuthenticated } = useAuth();
  const { data: myLibrary } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const addFromCatalog = useAddFromCatalog();
  const addWant = useAddWant();
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingCatalogId, setPendingCatalogId] = useState<string | null>(null);
  const [wantingGameId, setWantingGameId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [playerCount, setPlayerCount] = useState<number[]>([4]);
  const [maxTime, setMaxTime] = useState<number[]>([240]);
  const [weightRange, setWeightRange] = useState<number[]>([1, 5]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>("title");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const sidebarFilter = searchParams.get("filter");
  const sidebarValue = searchParams.get("value");

  // Debounce search input 300ms
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchTerm]);

  const showExpansions = sidebarFilter === "status" && sidebarValue === "expansions";

  // Build query with all server-side filters
  const buildQuery = useCallback(async (pageParam: number) => {
    let query = supabase
      .from("game_catalog")
      .select("id, title, slug, bgg_id, image_url, description, min_players, max_players, play_time_minutes, weight, year_published, is_expansion, bgg_url, bgg_community_rating, suggested_age", { count: pageParam === 0 ? "exact" : undefined })
      .eq("is_expansion", showExpansions);

    if (debouncedSearch) {
      query = query.ilike("title", `%${debouncedSearch}%`);
    }

    // Sidebar filters
    if (sidebarFilter === "letter" && sidebarValue) {
      if (sidebarValue === "#") {
        query = query.not("title", "ilike", "a%").not("title", "ilike", "b%").not("title", "ilike", "c%")
          .not("title", "ilike", "d%").not("title", "ilike", "e%").not("title", "ilike", "f%")
          .not("title", "ilike", "g%").not("title", "ilike", "h%").not("title", "ilike", "i%")
          .not("title", "ilike", "j%").not("title", "ilike", "k%").not("title", "ilike", "l%")
          .not("title", "ilike", "m%").not("title", "ilike", "n%").not("title", "ilike", "o%")
          .not("title", "ilike", "p%").not("title", "ilike", "q%").not("title", "ilike", "r%")
          .not("title", "ilike", "s%").not("title", "ilike", "t%").not("title", "ilike", "u%")
          .not("title", "ilike", "v%").not("title", "ilike", "w%").not("title", "ilike", "x%")
          .not("title", "ilike", "y%").not("title", "ilike", "z%");
      } else {
        query = query.ilike("title", `${sidebarValue}%`);
      }
    }

    if (sidebarFilter === "players" && sidebarValue) {
      const rangeMatch = sidebarValue.match(/(\d+)-(\d+)/);
      const plusMatch = sidebarValue.match(/(\d+)\+/);
      const singleMatch = sidebarValue.match(/^(\d+)$/);
      if (rangeMatch) {
        query = query.lte("min_players", parseInt(rangeMatch[2])).gte("max_players", parseInt(rangeMatch[1]));
      } else if (plusMatch) {
        query = query.gte("max_players", parseInt(plusMatch[1]));
      } else if (singleMatch) {
        const count = parseInt(singleMatch[1]);
        query = query.lte("min_players", count).gte("max_players", count);
      }
    }

    if (sidebarFilter === "difficulty" && sidebarValue) {
      const weightMap: Record<string, [number, number]> = {
        "1 - Light": [0, 1.5], "2 - Medium Light": [1.5, 2.25],
        "3 - Medium": [2.25, 3.0], "4 - Medium Heavy": [3.0, 3.75], "5 - Heavy": [3.75, 5.0],
      };
      const range = weightMap[sidebarValue];
      if (range) query = query.gte("weight", range[0]).lte("weight", range[1]);
    }

    if (sidebarFilter === "designer" && sidebarValue) {
      const { data: designerIds } = await (supabase as any)
        .from("catalog_designers")
        .select("catalog_id, designer:designers!inner(name)")
        .eq("designer.name", sidebarValue);
      const matchIds = (designerIds || []).map((d: any) => d.catalog_id);
      if (matchIds.length > 0) {
        query = query.in("id", matchIds);
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    }

    if (sidebarFilter === "artist" && sidebarValue) {
      const { data: artistIds } = await (supabase as any)
        .from("catalog_artists")
        .select("catalog_id, artist:artists!inner(name)")
        .eq("artist.name", sidebarValue);
      const matchIds = (artistIds || []).map((d: any) => d.catalog_id);
      if (matchIds.length > 0) {
        query = query.in("id", matchIds);
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    }

    if (sidebarFilter === "publisher" && sidebarValue) {
      const { data: pubIds } = await (supabase as any)
        .from("catalog_publishers")
        .select("catalog_id, publisher:publishers!inner(name)")
        .eq("publisher.name", sidebarValue);
      const matchIds = (pubIds || []).map((d: any) => d.catalog_id);
      if (matchIds.length > 0) {
        query = query.in("id", matchIds);
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    }

    if (sidebarFilter === "mechanic" && sidebarValue) {
      const { data: mechIds } = await (supabase as any)
        .from("catalog_mechanics")
        .select("catalog_id, mechanic:mechanics!inner(name)")
        .eq("mechanic.name", sidebarValue);
      const matchIds = (mechIds || []).map((d: any) => d.catalog_id);
      if (matchIds.length > 0) {
        query = query.in("id", matchIds);
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    }

    if (showFilters) {
      const count = playerCount[0];
      query = query.lte("min_players", count).gte("max_players", count);
      query = query.lte("play_time_minutes", maxTime[0]);
      query = query.gte("weight", weightRange[0]).lte("weight", weightRange[1]);
    }

    // Sorting
    switch (sortBy) {
      case "rating": query = query.order("bgg_community_rating", { ascending: false, nullsFirst: false }); break;
      case "weight": query = query.order("weight", { ascending: true, nullsFirst: false }); break;
      case "year": query = query.order("year_published", { ascending: false, nullsFirst: false }); break;
      default: query = query.order("title", { ascending: true }); break;
    }

    const from = pageParam * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { games: data || [], total: count ?? undefined, page: pageParam };
  }, [showExpansions, debouncedSearch, sidebarFilter, sidebarValue, showFilters, playerCount, maxTime, weightRange, sortBy]);

  // Infinite query
  const {
    data: infiniteData,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["catalog-browse-infinite", debouncedSearch, sortBy, sidebarFilter, sidebarValue, showFilters, playerCount, maxTime, weightRange, showExpansions],
    queryFn: ({ pageParam = 0 }) => buildQuery(pageParam),
    getNextPageParam: (lastPage) => {
      if (lastPage.games.length < PAGE_SIZE) return undefined;
      return lastPage.page + 1;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
  });

  // Flatten all pages into a single array
  const rawGames = useMemo(() => infiniteData?.pages.flatMap(p => p.games) || [], [infiniteData]);
  const totalCount = infiniteData?.pages[0]?.total ?? rawGames.length;

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { rootMargin: "400px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Fetch junction metadata for all loaded games
  const allGameIds = useMemo(() => rawGames.map(g => g.id), [rawGames]);
  const { data: metadata } = useQuery({
    queryKey: ["catalog-browse-metadata", allGameIds],
    queryFn: async () => {
      if (rawGames.length === 0) return null;
      const ids = rawGames.map(g => g.id);

      // Batch in chunks of 200 to avoid URL overflow
      const batchFetch = async (table: string, selectStr: string) => {
        const results: any[] = [];
        for (let i = 0; i < ids.length; i += 200) {
          const batch = ids.slice(i, i + 200);
          const { data } = await (supabase as any).from(table).select(selectStr).in("catalog_id", batch);
          results.push(...(data || []));
        }
        return results;
      };

      const [designersRows, artistsRows, mechanicsRows, publishersRows, ratingsRows] = await Promise.all([
        batchFetch("catalog_designers", "catalog_id, designer:designers(name)"),
        batchFetch("catalog_artists", "catalog_id, artist:artists(name)"),
        batchFetch("catalog_mechanics", "catalog_id, mechanic:mechanics(name)"),
        batchFetch("catalog_publishers", "catalog_id, publisher:publishers(name)"),
        batchFetch("catalog_ratings_summary", "catalog_id, visitor_average, visitor_count"),
      ]);

      const buildMap = (rows: any[], key: string) => {
        const map = new Map<string, string[]>();
        for (const row of rows || []) {
          const name = row[key]?.name;
          if (name) {
            const list = map.get(row.catalog_id) || [];
            list.push(name);
            map.set(row.catalog_id, list);
          }
        }
        return map;
      };

      const ratingMap = new Map<string, { avg: number; count: number }>();
      for (const row of ratingsRows || []) {
        if (row.visitor_count && row.visitor_count > 0) {
          ratingMap.set(row.catalog_id, { avg: Number(row.visitor_average) || 0, count: row.visitor_count });
        }
      }

      return {
        designerMap: buildMap(designersRows, "designer"),
        artistMap: buildMap(artistsRows, "artist"),
        mechanicMap: buildMap(mechanicsRows, "mechanic"),
        publisherMap: buildMap(publishersRows, "publisher"),
        ratingMap,
      };
    },
    enabled: rawGames.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Merge games with metadata
  const catalogGames: CatalogGame[] = useMemo(() => {
    return rawGames.map(g => {
      const r = metadata?.ratingMap.get(g.id);
      return {
        ...g,
        designers: metadata?.designerMap.get(g.id) || [],
        artists: metadata?.artistMap.get(g.id) || [],
        mechanics: metadata?.mechanicMap.get(g.id) || [],
        publishers: metadata?.publisherMap.get(g.id) || [],
        community_rating: r ? r.avg : null,
        community_rating_count: r?.count || 0,
      };
    });
  }, [rawGames, metadata]);

  // Sidebar filter lists — single RPC call for all distinct names
  const { data: sidebarMeta } = useQuery({
    queryKey: ["catalog-sidebar-meta"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_catalog_filter_options");
      if (error) throw error;
      const result = data as any;
      return {
        designers: (result?.designers || []) as string[],
        artists: (result?.artists || []) as string[],
        mechanics: ((result?.mechanics || []) as string[]).map((n: string) => ({ id: n, name: n })),
        publishers: ((result?.publishers || []) as string[]).map((n: string) => ({ id: n, name: n })),
      };
    },
    staleTime: 1000 * 60 * 30,
  });

  const handleSearchChange = (val: string) => { setSearchTerm(val); };

  const handleAddGame = (gameId: string) => {
    if (myLibraries.length > 1) {
      setPendingCatalogId(gameId);
      setPickerOpen(true);
    } else {
      addFromCatalog.mutate({ catalogId: gameId, libraryId: myLibrary?.id });
    }
  };

  const handleWantGame = (game: CatalogGameItem) => {
    if (!game.bgg_id) return;
    setWantingGameId(game.id);
    addWant.mutate(
      { bgg_id: game.bgg_id, game_title: game.title },
      {
        onSuccess: () => {
          toast({ title: "Added to Wishlist", description: `"${game.title}" added to your Wishlist.` });
          setWantingGameId(null);
        },
        onError: (err: any) => {
          const isDuplicate = err?.code === "23505" || err?.message?.includes("duplicate");
          toast({
            title: isDuplicate ? "Already on Wishlist" : "Error",
            description: isDuplicate ? `"${game.title}" is already on your Wishlist.` : "Failed to add to Wishlist.",
            variant: isDuplicate ? "default" : "destructive",
          });
          setWantingGameId(null);
        },
      }
    );
  };

  const handlePickerSelect = (libraryId: string) => {
    if (pendingCatalogId) {
      addFromCatalog.mutate({ catalogId: pendingCatalogId, libraryId }, {
        onSettled: () => {
          setPickerOpen(false);
          setPendingCatalogId(null);
        },
      });
    }
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
        designers={sidebarMeta?.designers || []}
        artists={sidebarMeta?.artists || []}
        mechanics={sidebarMeta?.mechanics || []}
        publishers={sidebarMeta?.publishers || []}
        isOpen={sidebarOpen}
      />

      {/* Main content - offset by sidebar width */}
      <div className="lg:ml-72">
        <div className="container mx-auto px-4 py-8 max-w-[2000px]">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold">GameTaverns Library</h1>
            <p className="text-muted-foreground">
              {totalCount} games in collection
            </p>
          </div>

          {/* Search & Sort Bar */}
          <div className="space-y-4 mb-8">
          {/* Search - full width on narrow screens */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search games, designers, or artists..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sort + View + Filter controls */}
          <div className="flex gap-2 flex-wrap">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px] sm:w-[160px]">
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
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => setViewMode("list")}
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
              games={catalogGames}
              isAuthenticated={isAuthenticated}
              addingId={addFromCatalog.variables?.catalogId}
              isPending={addFromCatalog.isPending}
              onAdd={handleAddGame}
              onWant={handleWantGame}
              wantingId={wantingGameId ?? undefined}
              isWanting={addWant.isPending}
            />
          ) : (
            <CatalogGameList
              games={catalogGames}
              isAuthenticated={isAuthenticated}
              addingId={addFromCatalog.variables?.catalogId}
              isPending={addFromCatalog.isPending}
              onAdd={handleAddGame}
            />
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {catalogGames.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-display text-xl mb-2">No games found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
      <LibraryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        libraries={myLibraries}
        onSelect={handlePickerSelect}
        isPending={addFromCatalog.isPending}
        gameTitle={catalogGames.find(g => g.id === pendingCatalogId)?.title}
      />
    </Layout>
  );
}
