import { useRef, useState, useEffect } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCatalogGameSearch, type CatalogSearchResult } from "@/hooks/useCatalogGameSearch";
import { GameImage } from "@/components/games/GameImage";

interface CatalogGamePickerProps {
  /** Already-selected games */
  selected: CatalogSearchResult[];
  onSelect: (game: CatalogSearchResult) => void;
  onRemove: (gameId: string) => void;
  maxSelections?: number;
  placeholder?: string;
}

export function CatalogGamePicker({
  selected,
  onSelect,
  onRemove,
  maxSelections = 2,
  placeholder = "Search for a game...",
}: CatalogGamePickerProps) {
  const { searchTerm, handleSearch, clear, results, isLoading } = useCatalogGameSearch(3);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (game: CatalogSearchResult) => {
    if (selected.some(s => s.id === game.id)) return;
    onSelect(game);
    clear();
    setShowResults(false);
  };

  const atMax = selected.length >= maxSelections;

  return (
    <div className="space-y-2">
      {/* Selected games */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(game => (
            <Badge key={game.id} variant="secondary" className="gap-1.5 pl-1 pr-1.5 py-1">
              {game.image_url && (
                <GameImage
                  imageUrl={game.image_url}
                  alt={game.title}
                  className="h-5 w-5 rounded object-cover"
                />
              )}
              <span className="text-xs">{game.title}</span>
              <button
                type="button"
                onClick={() => onRemove(game.id)}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      {!atMax && (
        <div ref={containerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => {
                handleSearch(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              placeholder={placeholder}
              className="pl-8 h-9 text-sm"
            />
            {isLoading && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Dropdown results */}
          {showResults && searchTerm.length >= 3 && (
            <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
              {results.length === 0 && !isLoading && (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  No games found
                </div>
              )}
              {results
                .filter(r => !selected.some(s => s.id === r.id))
                .map(game => (
                <button
                  key={game.id}
                  type="button"
                  className="w-full flex items-center gap-3 p-2 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => handleSelect(game)}
                >
                  {game.image_url ? (
                    <GameImage
                      imageUrl={game.image_url}
                      alt={game.title}
                      className="h-10 w-10 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <Search className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{game.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {game.year_published && `${game.year_published}`}
                      {game.min_players && game.max_players && ` · ${game.min_players}–${game.max_players} players`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {atMax && (
        <p className="text-xs text-muted-foreground">
          Maximum {maxSelections} game{maxSelections !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
