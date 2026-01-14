import { useState } from "react";
import { Plus, Minus, Trophy, Sparkles, Clock, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useGameSessions, type CreateSessionInput } from "@/hooks/useGameSessions";

interface PlayerInput {
  name: string;
  score: string;
  isWinner: boolean;
  isFirstPlay: boolean;
}

interface LogPlayDialogProps {
  gameId: string;
  gameTitle: string;
  children: React.ReactNode;
}

export function LogPlayDialog({ gameId, gameTitle, children }: LogPlayDialogProps) {
  const [open, setOpen] = useState(false);
  const { createSession } = useGameSessions(gameId);

  const [playedAt, setPlayedAt] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  });
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [players, setPlayers] = useState<PlayerInput[]>([
    { name: "", score: "", isWinner: false, isFirstPlay: false },
  ]);

  const addPlayer = () => {
    setPlayers([...players, { name: "", score: "", isWinner: false, isFirstPlay: false }]);
  };

  const removePlayer = (index: number) => {
    if (players.length > 1) {
      setPlayers(players.filter((_, i) => i !== index));
    }
  };

  const updatePlayer = (index: number, field: keyof PlayerInput, value: string | boolean) => {
    const updated = [...players];
    updated[index] = { ...updated[index], [field]: value };
    setPlayers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validPlayers = players.filter((p) => p.name.trim());

    const input: CreateSessionInput = {
      game_id: gameId,
      played_at: new Date(playedAt).toISOString(),
      duration_minutes: duration ? parseInt(duration, 10) : null,
      notes: notes.trim() || null,
      players: validPlayers.map((p) => ({
        player_name: p.name.trim(),
        score: p.score ? parseInt(p.score, 10) : null,
        is_winner: p.isWinner,
        is_first_play: p.isFirstPlay,
      })),
    };

    await createSession.mutateAsync(input);
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    const now = new Date();
    setPlayedAt(now.toISOString().slice(0, 16));
    setDuration("");
    setNotes("");
    setPlayers([{ name: "", score: "", isWinner: false, isFirstPlay: false }]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log a Play</DialogTitle>
          <DialogDescription>Record a play session for {gameTitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="played-at" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date & Time
              </Label>
              <Input
                id="played-at"
                type="datetime-local"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Duration (min)
              </Label>
              <Input
                id="duration"
                type="number"
                min="1"
                placeholder="60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>

          {/* Players */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Players</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPlayer}>
                <Plus className="h-4 w-4 mr-1" />
                Add Player
              </Button>
            </div>

            <div className="space-y-3">
              {players.map((player, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Player name"
                        value={player.name}
                        onChange={(e) => updatePlayer(index, "name", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Score"
                        value={player.score}
                        onChange={(e) => updatePlayer(index, "score", e.target.value)}
                        className="w-24"
                      />
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={player.isWinner}
                          onCheckedChange={(checked) =>
                            updatePlayer(index, "isWinner", !!checked)
                          }
                        />
                        <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                        Winner
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={player.isFirstPlay}
                          onCheckedChange={(checked) =>
                            updatePlayer(index, "isFirstPlay", !!checked)
                          }
                        />
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        First play
                      </label>
                    </div>
                  </div>
                  {players.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePlayer(index)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any notes about this session..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSession.isPending}>
              {createSession.isPending ? "Saving..." : "Log Play"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
