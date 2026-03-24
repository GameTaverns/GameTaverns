import { PickerChip } from "./PickerChip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GENRE_OPTIONS } from "@/types/game";

const GAME_TYPES = ["Board Game", "Card Game", "Dice Game", "Party Game", "War Game", "Miniatures", "RPG", "Other"];
const PLAY_TIMES = ["0-15 Minutes", "15-30 Minutes", "30-45 Minutes", "45-60 Minutes", "60+ Minutes"];

interface PickerFilterTabProps {
  selectedTypes: string[];
  toggleType: (t: string) => void;
  selectedGenres: string[];
  toggleGenre: (g: string) => void;
  selectedMechanics: string[];
  toggleMechanic: (m: string) => void;
  mechanicFamilyNames: string[];
  selectedPlayTimes: string[];
  togglePlayTime: (pt: string) => void;
  playerCount: string;
  setPlayerCount: (v: string) => void;
}

export function PickerFilterTab({
  selectedTypes, toggleType,
  selectedGenres, toggleGenre,
  selectedMechanics, toggleMechanic, mechanicFamilyNames,
  selectedPlayTimes, togglePlayTime,
  playerCount, setPlayerCount,
}: PickerFilterTabProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Game Type</p>
        <div className="flex flex-wrap gap-1.5">
          {GAME_TYPES.map(t => (
            <PickerChip key={t} label={t} selected={selectedTypes.includes(t)} onClick={() => toggleType(t)} />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Genre</p>
        <div className="flex flex-wrap gap-1.5">
          {GENRE_OPTIONS.map(g => (
            <PickerChip key={g} label={g} selected={selectedGenres.includes(g)} onClick={() => toggleGenre(g)} />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Mechanic</p>
        <div className="flex flex-wrap gap-1.5">
          {mechanicFamilyNames.map(m => (
            <PickerChip key={m} label={m} selected={selectedMechanics.includes(m)} onClick={() => toggleMechanic(m)} />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Play Time</p>
        <div className="flex flex-wrap gap-1.5">
          {PLAY_TIMES.map(pt => (
            <PickerChip key={pt} label={pt} selected={selectedPlayTimes.includes(pt)} onClick={() => togglePlayTime(pt)} />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Player Count</p>
        <Select value={playerCount} onValueChange={setPlayerCount}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <SelectItem key={n} value={String(n)}>{n} Player{n !== 1 ? "s" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
