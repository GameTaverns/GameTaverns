import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X, Dices } from "lucide-react";
import { cn } from "@/lib/utils";

interface PickerGame {
  id: string;
  title: string;
  image_url: string | null;
}

interface PickerPickGamesTabProps {
  games: PickerGame[];
  selectedIds: string[];
  toggleGame: (id: string) => void;
}

export function PickerPickGamesTab({ games, selectedIds, toggleGame }: PickerPickGamesTabProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return games;
    const q = search.toLowerCase();
    return games.filter(g => g.title.toLowerCase().includes(q));
  }, [games, search]);

  const selectedGames = games.filter(g => selectedIds.includes(g.id));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Select up to 10 games to randomize from</p>

      {selectedGames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedGames.map(g => (
            <Badge
              key={g.id}
              variant="secondary"
              className="gap-1 cursor-pointer text-xs"
              onClick={() => toggleGame(g.id)}
            >
              {g.title}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search games..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      <div className="max-h-[240px] overflow-y-auto space-y-0.5 pr-1">
        {filtered.slice(0, 50).map(game => (
          <div
            key={game.id}
            onClick={() => {
              if (selectedIds.length >= 10 && !selectedIds.includes(game.id)) return;
              toggleGame(game.id);
            }}
            className={cn(
              "flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors",
              selectedIds.includes(game.id)
                ? "bg-primary/10 border border-primary/30"
                : selectedIds.length >= 10
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-muted/50"
            )}
          >
            {game.image_url ? (
              <img src={game.image_url} alt="" className="w-7 h-7 rounded object-cover" />
            ) : (
              <div className="w-7 h-7 rounded bg-muted flex items-center justify-center">
                <Dices className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
            <span className="text-sm flex-1 truncate">{game.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
