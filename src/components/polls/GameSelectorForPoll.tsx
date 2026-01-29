import { useState } from "react";
import { Search, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { GameImage } from "@/components/games/GameImage";
import { useDebounce } from "@/hooks/useDebounce";

interface GameSelectorForPollProps {
  libraryId: string;
  selectedGameIds: string[];
  onSelectionChange: (gameIds: string[]) => void;
  maxGames?: number;
}

interface GameOption {
  id: string;
  title: string;
  image_url: string | null;
  min_players: number | null;
  max_players: number | null;
}

export function GameSelectorForPoll({
  libraryId,
  selectedGameIds,
  onSelectionChange,
  maxGames = 10,
}: GameSelectorForPollProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Fetch games for the library
  const { data: games = [], isLoading } = useQuery({
    queryKey: ["games-for-poll", libraryId, debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("games")
        .select("id, title, image_url, min_players, max_players")
        .eq("library_id", libraryId)
        .eq("is_expansion", false)
        .order("title");

      if (debouncedSearch) {
        query = query.ilike("title", `%${debouncedSearch}%`);
      } else {
        query = query.limit(50);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GameOption[];
    },
    enabled: !!libraryId,
  });

  // Fetch selected games details (for displaying badges)
  const { data: selectedGames = [] } = useQuery({
    queryKey: ["selected-games-for-poll", selectedGameIds],
    queryFn: async () => {
      if (selectedGameIds.length === 0) return [];

      const { data, error } = await supabase
        .from("games")
        .select("id, title, image_url")
        .in("id", selectedGameIds);

      if (error) throw error;
      return data as GameOption[];
    },
    enabled: selectedGameIds.length > 0,
  });

  const toggleGame = (gameId: string) => {
    if (selectedGameIds.includes(gameId)) {
      onSelectionChange(selectedGameIds.filter((id) => id !== gameId));
    } else if (selectedGameIds.length < maxGames) {
      onSelectionChange([...selectedGameIds, gameId]);
    }
  };

  const removeGame = (gameId: string) => {
    onSelectionChange(selectedGameIds.filter((id) => id !== gameId));
  };

  return (
    <div className="space-y-4">
      {/* Selected games badges */}
      {selectedGames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedGames.map((game) => (
            <Badge key={game.id} variant="secondary" className="pl-2 pr-1 py-1 gap-2">
              <span className="max-w-32 truncate">{game.title}</span>
              <button
                type="button"
                onClick={() => removeGame(game.id)}
                className="hover:bg-muted-foreground/20 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search games..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Game list */}
      <ScrollArea className="h-[300px] border rounded-lg">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">Loading games...</div>
        ) : games.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {search ? "No games match your search" : "No games in this library"}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {games.map((game) => {
              const isSelected = selectedGameIds.includes(game.id);
              const isDisabled = !isSelected && selectedGameIds.length >= maxGames;

              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => !isDisabled && toggleGame(game.id)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                    isSelected
                      ? "bg-primary/10 border border-primary"
                      : isDisabled
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-muted">
                    {game.image_url ? (
                      <GameImage
                        imageUrl={game.image_url}
                        alt={game.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{game.title}</div>
                    {(game.min_players || game.max_players) && (
                      <div className="text-xs text-muted-foreground">
                        {game.min_players}–{game.max_players} players
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <p className="text-xs text-muted-foreground">
        {selectedGameIds.length} of {maxGames} games selected
      </p>
    </div>
  );
}
