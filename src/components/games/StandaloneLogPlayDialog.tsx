import { useState, useCallback } from "react";
import { Search, Dices, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/backend/client";
import { useQuery } from "@tanstack/react-query";
import { useMyLibraries } from "@/hooks/useLibrary";
import { useAddFromCatalog } from "@/hooks/useAddFromCatalog";
import { LogPlayDialog } from "./LogPlayDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface GameResult {
  id: string;
  title: string;
  image_url: string | null;
  source: "library" | "catalog";
  catalog_id?: string;
  year_published?: number | null;
}

function useGameSearch(query: string) {
  const { data: libraries } = useMyLibraries();
  const primaryLibraryId = libraries?.[0]?.id;

  return useQuery({
    queryKey: ["game-search-for-play", query, primaryLibraryId],
    queryFn: async (): Promise<GameResult[]> => {
      if (!query || query.length < 2) return [];

      const results: GameResult[] = [];

      // Search user's library games first
      if (primaryLibraryId) {
        const { data: libraryGames } = await supabase
          .from("games")
          .select("id, title, image_url, year_published")
          .eq("library_id", primaryLibraryId)
          .ilike("title", `%${query}%`)
          .order("title")
          .limit(10);

        if (libraryGames) {
          for (const g of libraryGames) {
            results.push({ ...g, source: "library" });
          }
        }
      }

      // Also search catalog
      const { data: catalogGames } = await supabase
        .from("game_catalog")
        .select("id, title, image_url, year_published")
        .eq("is_expansion", false)
        .ilike("title", `%${query}%`)
        .order("title")
        .limit(10);

      if (catalogGames) {
        const libraryTitles = new Set(results.map((r) => r.title.toLowerCase()));
        for (const g of catalogGames) {
          if (!libraryTitles.has(g.title.toLowerCase())) {
            results.push({ ...g, source: "catalog", catalog_id: g.id });
          }
        }
      }

      return results.slice(0, 15);
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

interface StandaloneLogPlayDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function StandaloneLogPlayDialog({ children, open: controlledOpen, onOpenChange: controlledOnOpenChange }: StandaloneLogPlayDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [search, setSearch] = useState("");
  const [selectedGame, setSelectedGame] = useState<{ id: string; title: string } | null>(null);
  const [resolving, setResolving] = useState(false);
  const { data: searchResults = [], isLoading } = useGameSearch(search);
  const addFromCatalog = useAddFromCatalog();
  const { data: libraries } = useMyLibraries();
  const { toast } = useToast();

  const handleSelectGame = useCallback(
    async (game: GameResult) => {
      if (game.source === "library") {
        setSelectedGame({ id: game.id, title: game.title });
      } else if (game.catalog_id) {
        // Need to resolve catalog → library game (played_only)
        setResolving(true);
        try {
          const result = await addFromCatalog.mutateAsync({
            catalogId: game.catalog_id,
            libraryId: libraries?.[0]?.id,
            ownershipStatus: "played_only",
            silent: true,
          });
          setSelectedGame({ id: result.game.id, title: result.game.title });
        } catch (err: any) {
          toast({
            title: "Couldn't resolve game",
            description: err.message,
            variant: "destructive",
          });
        } finally {
          setResolving(false);
        }
      }
    },
    [addFromCatalog, libraries, toast],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
      setSelectedGame(null);
    }
  };

  // If a game is selected, render the LogPlayDialog directly
  if (selectedGame) {
    return (
      <LogPlayDialog
        gameId={selectedGame.id}
        gameTitle={selectedGame.title}
        defaultOpen
        onClose={() => {
          setSelectedGame(null);
          setOpen(false);
        }}
      >
        {/* Hidden trigger — dialog opens via defaultOpen */}
        <span className="hidden" />
      </LogPlayDialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dices className="h-5 w-5 text-primary" />
            Log a Play
          </DialogTitle>
          <DialogDescription>Search for any game to record a play session</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by game title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {resolving && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up game...
            </div>
          )}

          {!resolving && isLoading && search.length >= 2 && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!resolving && !isLoading && searchResults.length > 0 && (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {searchResults.map((game) => (
                <button
                  key={`${game.source}-${game.id}`}
                  type="button"
                  onClick={() => handleSelectGame(game)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
                >
                  {game.image_url ? (
                    <img
                      src={game.image_url}
                      alt=""
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Dices className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{game.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {game.year_published && `${game.year_published} · `}
                      {game.source === "library" ? "In your library" : "From catalog"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!resolving && !isLoading && search.length >= 2 && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No games found for "{search}"
            </p>
          )}

          {!resolving && search.length < 2 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Type at least 2 characters to search
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
