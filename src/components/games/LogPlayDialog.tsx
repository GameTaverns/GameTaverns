import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus, Minus, Trophy, Sparkles, Clock, Calendar, Puzzle, UserPlus, UserCheck, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useGameSessions, type CreateSessionInput } from "@/hooks/useGameSessions";
import { supabase } from "@/integrations/backend/client";
import { PlayerTagSearch } from "./PlayerTagSearch";
import type { UserSearchResult } from "@/hooks/usePlayerSearch";

function toDateTimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

interface PlayerInput {
  name: string;
  score: string;
  isWinner: boolean;
  isFirstPlay: boolean;
  linkedUser?: UserSearchResult | null;
  showSearch?: boolean;
}

interface Expansion {
  id: string;
  title: string;
  image_url: string | null;
}

interface LogPlayDialogProps {
  gameId: string;
  gameTitle: string;
  children: React.ReactNode;
}

interface LogPlayDraft {
  playedAt: string;
  duration: string;
  notes: string;
  players: PlayerInput[];
  selectedExpansionIds: string[];
}

function readPersistedValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persistValue(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors
  }
}

function clearPersistedValue(key: string) {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

export function LogPlayDialog({ gameId, gameTitle, children }: LogPlayDialogProps) {
  const openKey = useMemo(() => `log_play_dialog_open_${gameId}`, [gameId]);
  const draftKey = useMemo(() => `log_play_dialog_draft_${gameId}`, [gameId]);

  const [open, setOpenRaw] = useState(() => readPersistedValue(openKey) === "true");
  const hydratedOnOpenRef = useRef(false);
  const { createSession } = useGameSessions(gameId);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      setOpenRaw(nextOpen);
      persistValue(openKey, String(nextOpen));
      if (!nextOpen) hydratedOnOpenRef.current = false;
    },
    [openKey],
  );

  const [playedAt, setPlayedAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [players, setPlayers] = useState<PlayerInput[]>([
    { name: "", score: "", isWinner: false, isFirstPlay: false, linkedUser: null, showSearch: false },
  ]);
  const [expansions, setExpansions] = useState<Expansion[]>([]);
  const [selectedExpansions, setSelectedExpansions] = useState<Set<string>>(new Set());
  const [loadingExpansions, setLoadingExpansions] = useState(false);

  useEffect(() => {
    if (open && gameId) {
      setLoadingExpansions(true);
      supabase
        .from("games")
        .select("id, title, image_url")
        .eq("parent_game_id", gameId)
        .eq("is_expansion", true)
        .order("title")
        .then(({ data, error }) => {
          if (!error && data) setExpansions(data);
          setLoadingExpansions(false);
        });
    }
  }, [open, gameId]);

  useEffect(() => {
    if (!open || hydratedOnOpenRef.current) return;

    const raw = readPersistedValue(draftKey);
    if (!raw) {
      hydratedOnOpenRef.current = true;
      return;
    }

    try {
      const draft = JSON.parse(raw) as Partial<LogPlayDraft>;
      if (typeof draft.playedAt === "string" && draft.playedAt) setPlayedAt(draft.playedAt);
      if (typeof draft.duration === "string") setDuration(draft.duration);
      if (typeof draft.notes === "string") setNotes(draft.notes);
      if (Array.isArray(draft.players) && draft.players.length > 0) setPlayers(draft.players);
      if (Array.isArray(draft.selectedExpansionIds)) setSelectedExpansions(new Set(draft.selectedExpansionIds));
    } catch {
      // Ignore corrupted drafts
    }

    hydratedOnOpenRef.current = true;
  }, [open, draftKey]);

  useEffect(() => {
    if (!open || !hydratedOnOpenRef.current) return;

    const draft: LogPlayDraft = {
      playedAt,
      duration,
      notes,
      players,
      selectedExpansionIds: Array.from(selectedExpansions),
    };

    persistValue(draftKey, JSON.stringify(draft));
  }, [open, playedAt, duration, notes, players, selectedExpansions, draftKey]);

  const toggleExpansion = (expansionId: string) => {
    setSelectedExpansions((prev) => {
      const next = new Set(prev);
      next.has(expansionId) ? next.delete(expansionId) : next.add(expansionId);
      return next;
    });
  };

  const addPlayer = () => {
    setPlayers([...players, { name: "", score: "", isWinner: false, isFirstPlay: false, linkedUser: null, showSearch: false }]);
  };

  const removePlayer = (index: number) => {
    if (players.length > 1) setPlayers(players.filter((_, i) => i !== index));
  };

  const updatePlayer = (index: number, field: keyof PlayerInput, value: string | boolean | UserSearchResult | null | undefined) => {
    const updated = [...players];
    updated[index] = { ...updated[index], [field]: value };
    setPlayers(updated);
  };

  const linkUser = (index: number, user: UserSearchResult) => {
    const updated = [...players];
    updated[index] = {
      ...updated[index],
      linkedUser: user,
      name: updated[index].name || (user.display_name ?? user.username ?? ""),
      showSearch: false,
    };
    setPlayers(updated);
  };

  const unlinkUser = (index: number) => {
    const updated = [...players];
    updated[index] = { ...updated[index], linkedUser: null, showSearch: false };
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
        color: null,
        linked_user_id: p.linkedUser?.user_id ?? null,
        tag_status: p.linkedUser ? "pending" : "none",
      })),
      expansion_ids: Array.from(selectedExpansions),
    };

    await createSession.mutateAsync(input);
    clearPersistedValue(draftKey);
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setPlayedAt(toDateTimeLocalValue(new Date()));
    setDuration("");
    setNotes("");
    setPlayers([{ name: "", score: "", isWinner: false, isFirstPlay: false, linkedUser: null, showSearch: false }]);
    setSelectedExpansions(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
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

          {/* Expansions Used */}
          {!loadingExpansions && expansions.length > 0 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Puzzle className="h-4 w-4" />
                Expansions Used
              </Label>
              <div className="grid gap-2 max-h-32 overflow-y-auto">
                {expansions.map((expansion) => (
                  <label
                    key={expansion.id}
                    className="flex items-center gap-3 p-2 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedExpansions.has(expansion.id)}
                      onCheckedChange={() => toggleExpansion(expansion.id)}
                    />
                    {expansion.image_url && (
                      <img src={expansion.image_url} alt={expansion.title || "Expansion cover"} className="w-8 h-8 rounded object-cover" />
                    )}
                    <span className="text-sm font-medium truncate">{expansion.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

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
                <div key={index} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                  {/* Name + Score row */}
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
                    {players.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePlayer(index)}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Checkboxes */}
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={player.isWinner}
                        onCheckedChange={(checked) => updatePlayer(index, "isWinner", !!checked)}
                      />
                      <Trophy className="h-3.5 w-3.5 text-secondary" />
                      Winner
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={player.isFirstPlay}
                        onCheckedChange={(checked) => updatePlayer(index, "isFirstPlay", !!checked)}
                      />
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      First play
                    </label>
                  </div>

                  {/* Link user to profile */}
                  <div className="pt-1">
                    {player.linkedUser ? (
                      <PlayerTagSearch
                        onSelect={(u) => linkUser(index, u)}
                        selectedUser={player.linkedUser}
                        onClear={() => unlinkUser(index)}
                      />
                    ) : player.showSearch ? (
                      <div className="space-y-1">
                        <PlayerTagSearch
                          onSelect={(u) => linkUser(index, u)}
                          placeholder="Search by name or @username..."
                        />
                        <button
                          type="button"
                          onClick={() => updatePlayer(index, "showSearch", false)}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <X className="h-3 w-3" /> Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updatePlayer(index, "showSearch", true)}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Link to site profile
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">ELO</Badge>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Linking a player to their profile will send them a tag request. When accepted, the session appears on their profile and updates ELO ratings.
            </p>
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
