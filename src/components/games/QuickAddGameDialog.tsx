import { useState, useCallback } from "react";
import { Search, Plus, Loader2, Library, BookOpen } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/backend/client";
import { useQuery } from "@tanstack/react-query";
import { useMyLibraries } from "@/hooks/useLibrary";
import { useAddFromCatalog } from "@/hooks/useAddFromCatalog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CatalogResult {
  id: string;
  title: string;
  image_url: string | null;
  year_published: number | null;
  min_players: number | null;
  max_players: number | null;
  is_expansion: boolean;
}

function useCatalogSearch(query: string) {
  return useQuery({
    queryKey: ["quick-add-catalog-search", query],
    queryFn: async (): Promise<CatalogResult[]> => {
      if (!query || query.length < 2) return [];
      const { data, error } = await supabase
        .from("game_catalog")
        .select("id, title, image_url, year_published, min_players, max_players, is_expansion")
        .eq("is_expansion", false)
        .ilike("title", `%${query}%`)
        .order("title")
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

interface QuickAddGameDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QuickAddGameDialog({ children, open: controlledOpen, onOpenChange: controlledOnOpenChange }: QuickAddGameDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [search, setSearch] = useState("");
  const { data: results = [], isLoading } = useCatalogSearch(search);
  const { data: libraries = [] } = useMyLibraries();
  const [selectedLibrary, setSelectedLibrary] = useState<string>("");
  const addFromCatalog = useAddFromCatalog();

  const libraryId = selectedLibrary || libraries[0]?.id;

  const handleAdd = useCallback((catalogId: string) => {
    if (!libraryId) return;
    addFromCatalog.mutate({ catalogId, libraryId });
  }, [libraryId, addFromCatalog]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Quick Add Game
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {libraries.length > 1 && (
            <Select value={libraryId} onValueChange={setSelectedLibrary}>
              <SelectTrigger className="h-9 text-sm">
                <Library className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Select library" />
              </SelectTrigger>
              <SelectContent>
                {libraries.map(lib => (
                  <SelectItem key={lib.id} value={lib.id}>{lib.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search the catalog..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && search.length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No games found for "{search}"</p>
          )}

          {!isLoading && results.length > 0 && (
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
              {results.map(game => (
                <div
                  key={game.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  {game.image_url ? (
                    <img src={game.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{game.title}</p>
                    <div className="flex items-center gap-2">
                      {game.year_published && (
                        <span className="text-xs text-muted-foreground">{game.year_published}</span>
                      )}
                      {game.min_players && game.max_players && (
                        <span className="text-xs text-muted-foreground">{game.min_players}–{game.max_players} players</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-8 w-8 p-0 opacity-60 group-hover:opacity-100"
                    onClick={() => handleAdd(game.id)}
                    disabled={addFromCatalog.isPending && addFromCatalog.variables?.catalogId === game.id}
                  >
                    {addFromCatalog.isPending && addFromCatalog.variables?.catalogId === game.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {search.length < 2 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Type at least 2 characters to search the game catalog
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
