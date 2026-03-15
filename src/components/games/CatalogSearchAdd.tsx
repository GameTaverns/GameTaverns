import { useState, useCallback } from "react";
import { Search, Plus, Loader2, Check, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAddFromCatalog } from "@/hooks/useAddFromCatalog";
import { AddGameStatusDialog } from "@/components/catalog/AddGameStatusDialog";
import { useTranslation } from "react-i18next";

interface CatalogSearchAddProps {
  libraryId?: string;
}

interface CatalogResult {
  id: string;
  title: string;
  image_url: string | null;
  year_published: number | null;
  min_players: number | null;
  max_players: number | null;
  is_expansion: boolean;
}

export function CatalogSearchAdd({ libraryId }: CatalogSearchAddProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingGame, setPendingGame] = useState<CatalogResult | null>(null);
  const addFromCatalog = useAddFromCatalog();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timeout);
  }, []);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["catalog-search-add", debouncedSearch],
    queryFn: async (): Promise<CatalogResult[]> => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];

      const { data } = await supabase
        .from("game_catalog")
        .select("id, title, image_url, year_published, min_players, max_players, is_expansion")
        .ilike("title", `%${debouncedSearch}%`)
        .order("title")
        .limit(20);

      return data || [];
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
  });

  const handleAdd = (game: CatalogResult) => {
    setPendingGame(game);
    setStatusDialogOpen(true);
  };

  const handleStatusSelect = async (status: "owned" | "coming_soon") => {
    if (!pendingGame) return;
    setStatusDialogOpen(false);
    await addFromCatalog.mutateAsync({
      catalogId: pendingGame.id,
      libraryId,
      isComingSoon: status === "coming_soon",
    });
    setAddedIds((prev) => new Set(prev).add(pendingGame.id));
    setPendingGame(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Add from Catalog
        </CardTitle>
        <CardDescription>
          Search our game catalog and add games to your library with one click.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for a game..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && debouncedSearch.length >= 2 && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No games found matching "{debouncedSearch}"
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {results.map((game) => {
              const isAdded = addedIds.has(game.id);
              const isAdding = addFromCatalog.isPending && addFromCatalog.variables?.catalogId === game.id;

              return (
                <div
                  key={game.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {game.image_url ? (
                    <img
                      src={game.image_url}
                      alt={game.title}
                      className="h-12 w-12 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{game.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {game.year_published && <span>{game.year_published}</span>}
                      {game.min_players && game.max_players && (
                        <span>
                          {game.min_players === game.max_players
                            ? `${game.min_players}p`
                            : `${game.min_players}-${game.max_players}p`}
                        </span>
                      )}
                      {game.is_expansion && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          Expansion
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={isAdded ? "ghost" : "default"}
                    disabled={isAdded || isAdding}
                    onClick={() => handleAdd(game)}
                    className="flex-shrink-0"
                  >
                    {isAdding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isAdded ? (
                      <><Check className="h-3.5 w-3.5 mr-1" /> Added</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5 mr-1" /> Add</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {!debouncedSearch && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Start typing to search our catalog of over 100,000 board games
          </div>
        )}
      </CardContent>
      <AddGameStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        onSelect={handleStatusSelect}
        isPending={addFromCatalog.isPending}
        gameTitle={pendingGame?.title}
      />
    </Card>
  );
}
