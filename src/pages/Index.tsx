import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpDown, X } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { GameGrid } from "@/components/games/GameGrid";
import { useGames } from "@/hooks/useGames";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type SortOption = "title" | "difficulty" | "playtime" | "newest";

const ITEMS_PER_PAGE = 20;

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: games = [], isLoading } = useGames();

  const filter = searchParams.get("filter");
  const filterValue = searchParams.get("value");
  const sortBy = (searchParams.get("sort") as SortOption) || "title";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  // Filter and sort games
  const filteredGames = useMemo(() => {
    let result = [...games];

    // Special filter for coming soon
    if (filter === "status" && filterValue === "coming-soon") {
      result = result.filter((g) => g.is_coming_soon);
    } else {
      // Exclude coming soon games from main catalog
      result = result.filter((g) => !g.is_coming_soon);

      // Category filters
      if (filter && filterValue) {
        switch (filter) {
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
        }
      }
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "difficulty":
          return a.difficulty.localeCompare(b.difficulty);
        case "playtime":
          return a.play_time.localeCompare(b.play_time);
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [games, filter, filterValue, sortBy]);

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
    setSearchParams({});
  };

  const hasActiveFilters = !!filter;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <Layout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {filter && filterValue ? filterValue : "Game Collection"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {filteredGames.length} {filteredGames.length === 1 ? "game" : "games"} in collection
              {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-40 bg-card">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="difficulty">Difficulty</SelectItem>
                  <SelectItem value="playtime">Play Time</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                </SelectContent>
              </Select>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
          <GameGrid games={paginatedGames} />

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                
                {getPageNumbers().map((page, index) => (
                  <PaginationItem key={index}>
                    {page === "ellipsis" ? (
                      <span className="px-3 py-2">...</span>
                    ) : (
                      <PaginationLink
                        onClick={() => handlePageChange(page)}
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
          )}
        </>
      )}
    </Layout>
  );
};

export default Index;
