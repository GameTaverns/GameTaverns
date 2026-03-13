import { useState } from "react";
import { Plus, Minus, Trophy, Sparkles, UserPlus, X, Ban, Flag, Medal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayerTagSearch } from "./PlayerTagSearch";
import type { UserSearchResult } from "@/hooks/usePlayerSearch";

export type ScoringType = "highest_wins" | "lowest_wins" | "win_lose" | "cooperative" | "no_score";

export interface PlayerInput {
  name: string;
  score: string;
  isWinner: boolean;
  isFirstPlay: boolean;
  linkedUser?: UserSearchResult | null;
  showSearch?: boolean;
  placement: string;
  playerOutcome: string;
}

interface PlayerScoreInputProps {
  player: PlayerInput;
  index: number;
  scoringType: ScoringType;
  canRemove: boolean;
  onUpdate: (index: number, field: keyof PlayerInput, value: any) => void;
  onRemove: (index: number) => void;
  onLink: (index: number, user: UserSearchResult) => void;
  onUnlink: (index: number) => void;
}

const OUTCOME_OPTIONS = [
  { value: "", label: "Active" },
  { value: "bankrupt", label: "Bankrupt" },
  { value: "eliminated", label: "Eliminated" },
  { value: "dnf", label: "DNF" },
];

export function PlayerScoreInput({
  player,
  index,
  scoringType,
  canRemove,
  onUpdate,
  onRemove,
  onLink,
  onUnlink,
}: PlayerScoreInputProps) {
  const showScore = scoringType === "highest_wins" || scoringType === "lowest_wins";
  const showPlacement = scoringType === "lowest_wins"; // placement-style games
  const showWinner = scoringType !== "cooperative" && scoringType !== "no_score";

  return (
    <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
      {/* Name + Score/Placement row */}
      <div className="flex gap-2">
        <Input
          placeholder="Player name"
          value={player.name}
          onChange={(e) => onUpdate(index, "name", e.target.value)}
          className="flex-1"
        />
        {showScore && (
          <Input
            type="number"
            placeholder="Score"
            value={player.score}
            onChange={(e) => onUpdate(index, "score", e.target.value)}
            className="w-24"
          />
        )}
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="h-9 w-9 text-muted-foreground hover:text-destructive flex-shrink-0"
          >
            <Minus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Checkboxes + Outcome */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        {showWinner && (
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={player.isWinner}
              onCheckedChange={(checked) => onUpdate(index, "isWinner", !!checked)}
            />
            <Trophy className="h-3.5 w-3.5 text-secondary" />
            Winner
          </label>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={player.isFirstPlay}
            onCheckedChange={(checked) => onUpdate(index, "isFirstPlay", !!checked)}
          />
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          First play
        </label>
        {showScore && (
          <Select
            value={player.playerOutcome}
            onValueChange={(val) => onUpdate(index, "playerOutcome", val)}
          >
            <SelectTrigger className="w-[120px] h-7 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {OUTCOME_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value || "__active"} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Link user to profile */}
      <div className="pt-1">
        {player.linkedUser ? (
          <PlayerTagSearch
            onSelect={(u) => onLink(index, u)}
            selectedUser={player.linkedUser}
            onClear={() => onUnlink(index)}
          />
        ) : player.showSearch ? (
          <div className="space-y-1">
            <PlayerTagSearch
              onSelect={(u) => onLink(index, u)}
              placeholder="Search by name or @username..."
            />
            <button
              type="button"
              onClick={() => onUpdate(index, "showSearch", false)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onUpdate(index, "showSearch", true)}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Link to site profile
            <Badge variant="secondary" className="text-[10px] px-1 py-0">ELO</Badge>
          </button>
        )}
      </div>
    </div>
  );
}
