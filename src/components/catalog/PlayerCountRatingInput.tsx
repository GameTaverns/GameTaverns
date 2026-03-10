import { useState } from "react";
import { Star, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PlayerCountRatingEntry {
  player_count: number;
  rating: number;
}

interface PlayerCountRatingInputProps {
  value: PlayerCountRatingEntry[];
  onChange: (entries: PlayerCountRatingEntry[]) => void;
  minPlayers?: number;
  maxPlayers?: number;
}

function MiniStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="cursor-pointer hover:scale-110 transition-transform"
        >
          <Star
            className={cn(
              "h-3.5 w-3.5",
              n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function PlayerCountRatingInput({ value, onChange, minPlayers = 1, maxPlayers = 8 }: PlayerCountRatingInputProps) {
  const [adding, setAdding] = useState(false);

  const usedCounts = new Set(value.map(v => v.player_count));
  const availableCounts = Array.from(
    { length: Math.min(maxPlayers, 10) - minPlayers + 1 },
    (_, i) => minPlayers + i
  ).filter(n => !usedCounts.has(n));

  const addEntry = (playerCount: number) => {
    onChange([...value, { player_count: playerCount, rating: 5 }]);
    setAdding(false);
  };

  const updateRating = (playerCount: number, rating: number) => {
    onChange(value.map(e => e.player_count === playerCount ? { ...e, rating } : e));
  };

  const removeEntry = (playerCount: number) => {
    onChange(value.filter(e => e.player_count !== playerCount));
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Rate by player count (optional)</Label>
      <p className="text-xs text-muted-foreground">How does this game play at different player counts?</p>

      {value
        .sort((a, b) => a.player_count - b.player_count)
        .map(entry => (
          <div key={entry.player_count} className="flex items-center gap-3 py-1">
            <span className="text-sm font-medium w-20 shrink-0">
              {entry.player_count} player{entry.player_count > 1 ? "s" : ""}
            </span>
            <MiniStars value={entry.rating} onChange={r => updateRating(entry.player_count, r)} />
            <span className="text-xs text-muted-foreground w-8">{entry.rating}/10</span>
            <button
              type="button"
              onClick={() => removeEntry(entry.player_count)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

      {adding ? (
        <div className="flex items-center gap-2">
          <Select onValueChange={v => addEntry(parseInt(v))}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue placeholder="Player count..." />
            </SelectTrigger>
            <SelectContent>
              {availableCounts.map(n => (
                <SelectItem key={n} value={n.toString()}>
                  {n} player{n > 1 ? "s" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      ) : availableCounts.length > 0 ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Add player count
        </Button>
      ) : null}
    </div>
  );
}
