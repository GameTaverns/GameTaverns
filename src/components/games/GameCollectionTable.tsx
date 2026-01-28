import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Edit, Trash2, Download, Star, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGames, useDeleteGame } from "@/hooks/useGames";
import { useGameRatingsSummary } from "@/hooks/useGameRatings";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { GameWithRelations } from "@/types/game";

type SortField = "title" | "game_type" | "difficulty" | "players" | "rating";
type SortDirection = "asc" | "desc";

export function GameCollectionTable() {
  const { toast } = useToast();
  const { data: games, isLoading } = useGames();
  const { data: ratingsData } = useGameRatingsSummary();
  const deleteGame = useDeleteGame();
  const { buildUrl } = useTenantUrl();
  
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<GameWithRelations | null>(null);

  // Flatten games to include expansions in the list
  const allGames = useMemo(() => {
    if (!games) return [];
    const flat: GameWithRelations[] = [];
    games.forEach((game) => {
      flat.push(game);
      if (game.expansions) {
        game.expansions.forEach((exp) => flat.push(exp));
      }
    });
    return flat;
  }, [games]);

  // Get rating for a game
  const getRating = (gameId: string) => {
    const rating = ratingsData?.find((r) => r.game_id === gameId);
    return rating?.average_rating ?? null;
  };

  // Generate alphabet for the alpha bar
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // Get letters that have games
  const lettersWithGames = useMemo(() => {
    const letters = new Set<string>();
    allGames.forEach((game) => {
      const firstChar = game.title.charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar)) {
        letters.add(firstChar);
      } else {
        letters.add("#"); // For games starting with numbers or special chars
      }
    });
    return letters;
  }, [allGames]);

  // Filter and sort games
  const filteredAndSortedGames = useMemo(() => {
    let result = allGames;

    // Filter by letter
    if (activeLetter) {
      if (activeLetter === "#") {
        result = result.filter((game) => !/^[A-Za-z]/.test(game.title));
      } else {
        result = result.filter((game) =>
          game.title.toUpperCase().startsWith(activeLetter)
        );
      }
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "game_type":
          comparison = (a.game_type || "").localeCompare(b.game_type || "");
          break;
        case "difficulty":
          comparison = (a.difficulty || "").localeCompare(b.difficulty || "");
          break;
        case "players":
          comparison = (a.min_players || 0) - (b.min_players || 0);
          break;
        case "rating":
          const ratingA = getRating(a.id) ?? 0;
          const ratingB = getRating(b.id) ?? 0;
          comparison = ratingA - ratingB;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [allGames, activeLetter, sortField, sortDirection, ratingsData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleDeleteClick = (game: GameWithRelations) => {
    setGameToDelete(game);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!gameToDelete) return;
    try {
      await deleteGame.mutateAsync(gameToDelete.id);
      toast({
        title: "Game deleted",
        description: `"${gameToDelete.title}" has been removed from your library.`,
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete the game. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setGameToDelete(null);
    }
  };

  const exportToCsv = () => {
    if (!filteredAndSortedGames.length) {
      toast({
        title: "No games to export",
        description: "Add some games to your library first.",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Title", "Type", "Difficulty", "Min Players", "Max Players", "Rating", "BGG ID", "Publisher"];
    const rows = filteredAndSortedGames.map((game) => [
      game.title,
      game.game_type || "",
      game.difficulty || "",
      game.min_players?.toString() || "",
      game.max_players?.toString() || "",
      getRating(game.id)?.toFixed(1) || "",
      game.bgg_id || "",
      game.publisher?.name || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `game-collection-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast({
      title: "Export complete",
      description: `Exported ${filteredAndSortedGames.length} games to CSV.`,
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar with Alpha Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredAndSortedGames.length} of {allGames.length} games
            {activeLetter && ` starting with "${activeLetter}"`}
          </div>
          <Button variant="outline" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Alpha Bar */}
        <div className="flex flex-wrap gap-0.5">
          <Button
            variant={activeLetter === null ? "default" : "outline"}
            size="sm"
            className="h-7 w-7 p-0 text-xs"
            onClick={() => setActiveLetter(null)}
          >
            All
          </Button>
          {lettersWithGames.has("#") && (
            <Button
              variant={activeLetter === "#" ? "default" : "outline"}
              size="sm"
              className="h-7 w-7 p-0 text-xs"
              onClick={() => setActiveLetter("#")}
            >
              #
            </Button>
          )}
          {alphabet.map((letter) => (
            <Button
              key={letter}
              variant={activeLetter === letter ? "default" : "outline"}
              size="sm"
              className="h-7 w-7 p-0 text-xs"
              onClick={() => setActiveLetter(letter)}
              disabled={!lettersWithGames.has(letter)}
            >
              {letter}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("title")}
              >
                Title <SortIcon field="title" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("game_type")}
              >
                Type <SortIcon field="game_type" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("difficulty")}
              >
                Difficulty <SortIcon field="difficulty" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("players")}
              >
                Players <SortIcon field="players" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("rating")}
              >
                Rating <SortIcon field="rating" />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedGames.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {activeLetter ? `No games starting with "${activeLetter}".` : "No games in your library yet."}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedGames.map((game) => {
                const rating = getRating(game.id);
                return (
                  <TableRow key={game.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {game.is_expansion && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">EXP</span>
                        )}
                        {game.title}
                      </div>
                    </TableCell>
                    <TableCell>{game.game_type || "-"}</TableCell>
                    <TableCell>
                      {game.difficulty ? game.difficulty.split(" - ")[1] || game.difficulty : "-"}
                    </TableCell>
                    <TableCell>
                      {game.min_players && game.max_players
                        ? game.min_players === game.max_players
                          ? game.min_players
                          : `${game.min_players}-${game.max_players}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-primary text-primary" />
                          <span>{rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <Link to={buildUrl(`/admin/edit/${game.slug || game.id}`)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit {game.title}</span>
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(game)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete {game.title}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Game</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{gameToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
