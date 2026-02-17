import { useMemo, useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ArrowUp, ArrowDown, X, AlertTriangle, Settings, Plus, Upload, BarChart3, LayoutGrid, List } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { GameGrid } from "@/components/games/GameGrid";
import { GameList } from "@/components/games/GameList";
import { FeatureTip } from "@/components/ui/FeatureTip";

import { QuadrantFilterButton } from "@/components/games/QuadrantFilterButton";
import { useGames } from "@/hooks/useGames";
import { DIFFICULTY_OPTIONS } from "@/types/game";
import { useDemoMode } from "@/contexts/DemoContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useAuth } from "@/hooks/useAuth";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import { useWishlist } from "@/hooks/useWishlist";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { siteConfig } from "@/config/site";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type SortOption = "title" | "difficulty" | "playtime" | "newest" | "rating";
type SortDir = "asc" | "desc";

const GRID_PAGE_SIZE = 30;
const LIST_PAGE_SIZE = 50;

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isDemoMode, demoGames } = useDemoMode();
  const { forSale: forSaleFlag, comingSoon: comingSoonFlag, wishlist: wishlistFlag, demoMode: demoModeEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const { data: realGames = [], isLoading: gamesLoading } = useGames(!isDemoMode);
  const { myVotes, isLoading: wishlistLoading } = useWishlist();
  const { library, isOwner, isTenantMode } = useTenant();
  const { isAuthenticated } = useAuth();
  const { buildUrl } = useTenantUrl();
  
  // Quadrant filter state
  const [quadrantFilter, setQuadrantFilter] = useState<{
    difficulty: number;
    playTime: number;
    intensity: number;
  } | null>(null);

  const handleQuadrantFilterChange = useCallback((filters: { difficulty: number; playTime: number; intensity: number } | null) => {
    setQuadrantFilter(filters);
  }, []);
  
  // Fetch ratings summary for top-rated filter - filtered by library_id to avoid URL length issues
  const { data: ratingsData, isLoading: ratingsLoading } = useQuery({
    queryKey: ["game-ratings-summary", library?.id],
    queryFn: async () => {
      if (!library?.id) return [];
      // Use join filtering to avoid huge IN() clauses that cause 502 errors
      const { data, error } = await supabase
        .from("game_ratings_summary")
        .select("game_id, average_rating, rating_count, games!inner(library_id)")
        .eq("games.library_id", library.id);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000, // 1 minute
    enabled: !!library?.id,
  });
  
  // Redirect away from demo mode if the feature is disabled
  useEffect(() => {
    if (!flagsLoading && !demoModeEnabled && searchParams.get("demo") === "true") {
      // Remove the demo param and navigate to home
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("demo");
      navigate("/?" + newParams.toString(), { replace: true });
    }
  }, [flagsLoading, demoModeEnabled, searchParams, navigate]);

  // Group expansions under parent games (same logic as useGames hook)
  const groupExpansions = (allGames: typeof demoGames): typeof demoGames => {
    const baseGames: typeof demoGames = [];
    const expansionMap = new Map<string, typeof demoGames>();

    allGames.forEach((game) => {
      if (game.is_expansion && game.parent_game_id) {
        const expansions = expansionMap.get(game.parent_game_id) || [];
        expansions.push(game);
        expansionMap.set(game.parent_game_id, expansions);
      } else {
        baseGames.push(game);
      }
    });

    baseGames.forEach((game) => {
      game.expansions = expansionMap.get(game.id) || [];
    });

    return baseGames;
  };
  
  // Use demo games when in demo mode, otherwise use real games
  // Demo games need groupExpansions applied since they're stored flat
  const games = isDemoMode ? groupExpansions([...demoGames]) : realGames;

  const filter = searchParams.get("filter");
  const filterValue = searchParams.get("value");
  const sortBy = (searchParams.get("sort") as SortOption) || "title";
  const sortDir = (searchParams.get("dir") as SortDir) || "asc";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const ITEMS_PER_PAGE = viewMode === "list" ? LIST_PAGE_SIZE : GRID_PAGE_SIZE;
  
  // Combine loading states - show skeleton when relevant data is loading
  const isLoading = gamesLoading || 
    (filter === "status" && filterValue === "wishlist" && wishlistLoading) ||
    (filter === "status" && filterValue === "top-rated" && ratingsLoading);

  // Filter and sort games
  const filteredGames = useMemo(() => {
    let result = [...games];

    // Handle status filters - must check feature flags properly
    if (filter === "status" && filterValue === "coming-soon") {
      // Only filter by coming-soon if the feature is enabled
      if (comingSoonFlag) {
        // Include both base games and expansions that are coming soon
        const allComingSoon: typeof result = [];
        const grouped = isDemoMode ? groupExpansions([...demoGames]) : realGames;
        grouped.forEach((g) => {
          if (g.is_coming_soon) allComingSoon.push(g);
          if (g.expansions && g.expansions.length > 0) {
            g.expansions.forEach((exp) => {
              if (exp.is_coming_soon) allComingSoon.push(exp);
            });
          }
        });
        result = allComingSoon;
      } else {
        // Feature is disabled, show no results for this filter
        result = [];
      }
    } else if (filter === "status" && filterValue === "for-sale") {
      // Only filter by for-sale if the feature is enabled
      if (forSaleFlag) {
        result = result.filter((g) => g.is_for_sale);
      } else {
        // Feature is disabled, show no results for this filter
        result = [];
      }
    } else if (filter === "status" && filterValue === "favorites") {
      // Show only favorited games (is_favorite = true)
      result = result.filter((g) => (g as any).is_favorite === true);
    } else if (filter === "status" && filterValue === "top-rated") {
      // Show games with average rating >= 4 and at least 1 rating
      if (ratingsData) {
        const highRatedGameIds = new Set(
          ratingsData
            .filter((r) => r.average_rating !== null && r.average_rating >= 4 && r.rating_count && r.rating_count > 0)
            .map((r) => r.game_id)
        );
        result = result.filter((g) => highRatedGameIds.has(g.id));
      } else {
        result = [];
      }
    } else if (filter === "status" && filterValue === "wishlist") {
      // Show games that the current user has voted for (most wanted)
      if (wishlistFlag && myVotes && myVotes.size > 0) {
        result = result.filter((g) => myVotes.has(g.id));
      } else {
        result = [];
      }
    } else if (filter === "status" && filterValue === "unplayed") {
      // Show games flagged as unplayed
      result = result.filter((g) => (g as any).is_unplayed === true);
    } else if (filter === "status" && filterValue === "expansions") {
      // Show all expansions — they're normally nested under parents in the grouped list,
      // so we need to extract them from parent.expansions + include orphan expansions
      const allExpansions: typeof result = [];
      const grouped = isDemoMode ? groupExpansions([...demoGames]) : realGames;
      grouped.forEach((g) => {
        // Orphan expansions (is_expansion but no parent) are top-level
        if (g.is_expansion) allExpansions.push(g);
        // Nested expansions under parents
        if (g.expansions && g.expansions.length > 0) {
          allExpansions.push(...g.expansions);
        }
      });
      result = allExpansions;
    } else {
      // Exclude coming soon games from main catalog (only if feature is enabled)
      if (comingSoonFlag) {
        result = result.filter((g) => !g.is_coming_soon);
      }

      // Category filters
      if (filter && filterValue) {
        switch (filter) {
          case "players":
            result = result.filter((g) => {
              const min = g.min_players ?? 0;
              const max = g.max_players ?? min;
              switch (filterValue) {
                case "1 Player":
                  return min <= 1 && max >= 1;
                case "2 Players":
                  return min <= 2 && max >= 2;
                case "3-4 Players":
                  return min <= 4 && max >= 3;
                case "5-6 Players":
                  return min <= 6 && max >= 5;
                case "7+ Players":
                  return max >= 7;
                default:
                  return true;
              }
            });
            break;
          case "difficulty":
            result = result.filter((g) => g.difficulty === filterValue);
            break;
          case "type":
            result = result.filter((g) => g.game_type === filterValue);
            break;
          case "playtime":
            result = result.filter((g) => g.play_time === filterValue);
            break;
          case "mechanic":
            result = result.filter((g) =>
              g.mechanics.some((m) => m.name === filterValue)
            );
            break;
          case "publisher":
            result = result.filter((g) => g.publisher?.name === filterValue);
            break;
          case "letter":
            result = result.filter((g) => 
              g.title.toUpperCase().startsWith(filterValue.toUpperCase())
            );
            break;
          case "age":
            // Filter games where suggested_age matches or is less restrictive
            result = result.filter((g) => {
              if (!g.suggested_age) return false;
              const gameAge = parseInt(g.suggested_age.replace("+", ""), 10);
              const filterAge = parseInt(filterValue.replace("+", ""), 10);
              return !isNaN(gameAge) && gameAge <= filterAge;
            });
            break;
          case "genre":
            result = result.filter((g) => (g as any).genre === filterValue);
            break;
          case "designer":
            result = result.filter((g) =>
              (g as any).designers?.some((d: any) => d.name === filterValue)
            );
            break;
          case "artist":
            result = result.filter((g) =>
              (g as any).artists?.some((a: any) => a.name === filterValue)
            );
            break;
        }
      }
    }

    // Apply quadrant filter (difficulty + play time)
    if (quadrantFilter) {
      const { difficulty: diffPos, playTime: playTimePos, intensity } = quadrantFilter;
      
      // Map play time position (0-1) to play time indices
      const PLAY_TIME_OPTIONS: string[] = [
        '0-15 Minutes',
        '15-30 Minutes',
        '30-45 Minutes',
        '45-60 Minutes',
        '60+ Minutes',
        '2+ Hours',
        '3+ Hours'
      ];
      
      const targetDiffIndex = Math.min(4, Math.floor(diffPos * 5));
      const targetPlayTimeIndex = Math.min(6, Math.floor(playTimePos * 7));
      
      // Range based on intensity (lower intensity = broader range)
      const diffRange = Math.ceil((1 - intensity) * 2) + 1; // 1-3 levels range
      const playTimeRange = Math.ceil((1 - intensity) * 3) + 1; // 1-4 levels range
      
      result = result.filter((g) => {
        // Check difficulty
        const gameDiffIndex = DIFFICULTY_OPTIONS.indexOf(g.difficulty as any);
        const diffMatch = gameDiffIndex >= 0 && 
          Math.abs(gameDiffIndex - targetDiffIndex) <= diffRange;
        
        // Check play time
        const gamePlayTimeIndex = PLAY_TIME_OPTIONS.indexOf(g.play_time as any);
        const playTimeMatch = gamePlayTimeIndex >= 0 && 
          Math.abs(gamePlayTimeIndex - targetPlayTimeIndex) <= playTimeRange;
        
        return diffMatch && playTimeMatch;
      });
    }

    // Sort
    const dir = sortDir === "desc" ? -1 : 1;
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "difficulty":
          cmp = a.difficulty.localeCompare(b.difficulty);
          break;
        case "playtime":
          cmp = a.play_time.localeCompare(b.play_time);
          break;
        case "newest":
          cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case "rating": {
          const aRating = ratingsData?.find(r => r.game_id === a.id)?.average_rating ?? 0;
          const bRating = ratingsData?.find(r => r.game_id === b.id)?.average_rating ?? 0;
          cmp = Number(aRating) - Number(bRating);
          break;
        }
        default:
          cmp = a.title.localeCompare(b.title);
      }
      return cmp * dir;
    });

    return result;
  }, [games, filter, filterValue, sortBy, sortDir, forSaleFlag, comingSoonFlag, wishlistFlag, ratingsData, myVotes, quadrantFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredGames.length / ITEMS_PER_PAGE);
  const paginatedGames = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGames.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredGames, currentPage]);

  const handleSortChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "title") {
      newParams.delete("sort");
    } else {
      newParams.set("sort", value);
    }
    newParams.delete("page"); // Reset to page 1 when sorting changes
    setSearchParams(newParams);
  };

  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    if (page === 1) {
      newParams.delete("page");
    } else {
      newParams.set("page", page.toString());
    }
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearFilters = () => {
    // Preserve demo mode when clearing filters
    if (isDemoMode) {
      setSearchParams({ demo: "true" });
    } else {
      setSearchParams({});
    }
  };

  const hasActiveFilters = !!filter;

  // Generate page numbers: 1, prev, current, next, last (5 slots with surrounding context)
  const getPageNumbers = () => {
    const pages: (number | "ellipsis" | null)[] = [];
    if (totalPages <= 5) {
      // Show all pages, pad with nulls to maintain consistent width
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      while (pages.length < 5) pages.push(null);
    } else {
      // 5 slots: first, prev/ellipsis, current, next/ellipsis, last
      if (currentPage <= 3) {
        // Near start: 1, 2, 3, ..., last
        pages.push(1, 2, 3, "ellipsis", totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near end: 1, ..., last-2, last-1, last
        pages.push(1, "ellipsis", totalPages - 2, totalPages - 1, totalPages);
      } else {
        // Middle: 1, ..., current, next, last
        pages.push(1, "ellipsis", currentPage, currentPage + 1, totalPages);
      }
    }
    return pages;
  };

  return (
    <Layout>
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10 mb-6">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400">Demo Mode Active</AlertTitle>
          <AlertDescription className="text-amber-600/80 dark:text-amber-400/80">
            You're viewing the demo collection. Changes made in the demo admin panel will appear here.
          </AlertDescription>
        </Alert>
      )}

      {/* Owner quick actions removed — available from dashboard */}

      {/* Feature Discovery Tip - only for owners */}
      {isAuthenticated && isOwner && isTenantMode && !isDemoMode && (
        <FeatureTip
          tipId="owner_edit_collection"
          title="Manage your collection"
          description="Use the sidebar links or the buttons above to edit your full collection, add games, or customize your library settings."
          className="mb-6"
        />
      )}

      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              {filter && filterValue ? filterValue : siteConfig.collectionTitle}
            </h1>
            <p className="text-muted-foreground mt-1">
              {filteredGames.length} {filteredGames.length === 1 ? "game" : "games"} in collection
              {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">

            {/* Sort */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  const newDir = sortDir === "asc" ? "desc" : "asc";
                  if (newDir === "asc") {
                    newParams.delete("dir");
                  } else {
                    newParams.set("dir", "desc");
                  }
                  newParams.delete("page");
                  setSearchParams(newParams);
                }}
                title={sortDir === "asc" ? "Sorted A→Z (click to reverse)" : "Sorted Z→A (click to reverse)"}
              >
                {sortDir === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </Button>
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-32 sm:w-40 bg-card text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="difficulty">Difficulty</SelectItem>
                  <SelectItem value="playtime">Play Time</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="rating">Star Rating</SelectItem>
                </SelectContent>
                </Select>

                {/* View mode toggle */}
                <div className="flex border border-border rounded-md">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-r-none"
                    onClick={() => { setViewMode("grid"); const p = new URLSearchParams(searchParams); p.delete("page"); setSearchParams(p); }}
                    title="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-l-none"
                    onClick={() => { setViewMode("list"); const p = new URLSearchParams(searchParams); p.delete("page"); setSearchParams(p); }}
                    title="List view"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-muted-foreground">Filters:</span>
            {filter && filterValue && (
              <Badge variant="secondary" className="gap-1">
                {filter}: {filterValue}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Game Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square rounded-lg" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <FeatureTip
            tipId="sidebar-filters"
            title="Use the sidebar to filter games"
            description="The left sidebar has filters for game type, difficulty, player count, mechanics, and more. On mobile, tap the menu icon to open it."
            className="mb-4"
          />
          {viewMode === "grid" ? (
            <GameGrid games={paginatedGames} hasActiveFilters={hasActiveFilters} />
          ) : (
            <GameList games={paginatedGames} hasActiveFilters={hasActiveFilters} />
          )}
        </>
      )}

      {/* Pagination (sticky within content so it won't cover the footer) */}
      {totalPages > 1 && (
        <div className="sticky bottom-0 z-30 bg-background/95 backdrop-blur-sm border-t border-border py-3 px-4 shadow-lg min-h-[60px]">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>

              {getPageNumbers().map((page, index) => (
                <PaginationItem key={index} className="w-10 flex justify-center">
                  {page === null ? (
                    <span className="w-10" />
                  ) : page === "ellipsis" ? (
                    <span className="px-3 py-2">...</span>
                  ) : (
                    <PaginationLink
                      onClick={() => handlePageChange(page as number)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Quadrant Filter Floating Button (mobile only) */}
      <QuadrantFilterButton onFilterChange={handleQuadrantFilterChange} />
    </Layout>
  );
};

export default Index;
