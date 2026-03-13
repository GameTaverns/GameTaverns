import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus, Clock, Calendar, Users, Handshake } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGameSessions, type CreateSessionInput } from "@/hooks/useGameSessions";
import { supabase } from "@/integrations/backend/client";
import { ExpansionPicker } from "./ExpansionPicker";
import { PlayerScoreInput, type PlayerInput, type ScoringType } from "./PlayerScoreInput";
import type { UserSearchResult } from "@/hooks/usePlayerSearch";

function toDateTimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

interface Expansion {
  id: string;
  title: string;
  image_url: string | null;
  expansion_type?: string;
}

interface LogPlayDialogProps {
  gameId: string;
  gameTitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onClose?: () => void;
}

interface LogPlayDraft {
  playedAt: string;
  duration: string;
  notes: string;
  players: PlayerInput[];
  selectedExpansionIds: string[];
  scoringType: ScoringType;
  cooperativeResult: string;
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
  } catch {}
}

function clearPersistedValue(key: string) {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {}
}

const SCORING_LABELS: Record<ScoringType, string> = {
  highest_wins: "Highest Score Wins",
  lowest_wins: "Lowest Score Wins",
  win_lose: "Win / Lose (no score)",
  cooperative: "Co-op (all win or all lose)",
  no_score: "No scoring",
};

function defaultPlayer(): PlayerInput {
  return { name: "", score: "", isWinner: false, isFirstPlay: false, linkedUser: null, showSearch: false, placement: "", playerOutcome: "" };
}

export function LogPlayDialog({ gameId, gameTitle, children, defaultOpen, onClose }: LogPlayDialogProps) {
  const openKey = useMemo(() => `log_play_dialog_open_${gameId}`, [gameId]);
  const draftKey = useMemo(() => `log_play_dialog_draft_${gameId}`, [gameId]);

  const [open, setOpenRaw] = useState(() => defaultOpen || readPersistedValue(openKey) === "true");
  const hydratedOnOpenRef = useRef(false);
  const { createSession } = useGameSessions(gameId);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      setOpenRaw(nextOpen);
      persistValue(openKey, String(nextOpen));
      if (!nextOpen) {
        hydratedOnOpenRef.current = false;
        onClose?.();
      }
    },
    [openKey, onClose],
  );

  const [playedAt, setPlayedAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [players, setPlayers] = useState<PlayerInput[]>([defaultPlayer()]);
  const [expansions, setExpansions] = useState<Expansion[]>([]);
  const [selectedExpansions, setSelectedExpansions] = useState<Set<string>>(new Set());
  const [loadingExpansions, setLoadingExpansions] = useState(false);
  const [scoringType, setScoringType] = useState<ScoringType>("highest_wins");
  const [cooperativeResult, setCooperativeResult] = useState<string>("");
  const [detectedScoringType, setDetectedScoringType] = useState<ScoringType | null>(null);

  // Fetch game's scoring type from catalog
  useEffect(() => {
    if (!open || !gameId) return;
    supabase
      .from("games")
      .select("catalog_id, scoring_type_override")
      .eq("id", gameId)
      .maybeSingle()
      .then(async ({ data: gameData }) => {
        if (gameData?.scoring_type_override) {
          setDetectedScoringType(gameData.scoring_type_override as ScoringType);
          setScoringType(gameData.scoring_type_override as ScoringType);
          return;
        }
        if (gameData?.catalog_id) {
          const { data: catalog } = await supabase
            .from("game_catalog")
            .select("scoring_type")
            .eq("id", gameData.catalog_id)
            .maybeSingle();
          if (catalog?.scoring_type && catalog.scoring_type !== "highest_wins") {
            setDetectedScoringType(catalog.scoring_type as ScoringType);
            setScoringType(catalog.scoring_type as ScoringType);
          }
        }
      });
  }, [open, gameId]);

  // Fetch expansions (only real expansions by default, include promos for filter)
  useEffect(() => {
    if (open && gameId) {
      setLoadingExpansions(true);
      supabase
        .from("games")
        .select("id, title, image_url, expansion_type_override, catalog_id")
        .eq("parent_game_id", gameId)
        .eq("is_expansion", true)
        .order("title")
        .then(async ({ data, error }) => {
          if (!error && data) {
            // Fetch catalog expansion_type for entries without override
            const catalogIds = [...new Set(data.filter((d) => !d.expansion_type_override && d.catalog_id).map((d) => d.catalog_id!))];
            let catalogTypes: Record<string, string> = {};
            if (catalogIds.length > 0) {
              const { data: cats } = await supabase
                .from("game_catalog")
                .select("id, expansion_type")
                .in("id", catalogIds);
              catalogTypes = (cats || []).reduce((acc, c) => { acc[c.id] = c.expansion_type; return acc; }, {} as Record<string, string>);
            }
            setExpansions(
              data.map((d) => ({
                id: d.id,
                title: d.title,
                image_url: d.image_url,
                expansion_type: d.expansion_type_override || (d.catalog_id ? catalogTypes[d.catalog_id] : undefined) || "expansion",
              }))
            );
          }
          setLoadingExpansions(false);
        });
    }
  }, [open, gameId]);

  // Hydrate draft
  useEffect(() => {
    if (!open || hydratedOnOpenRef.current) return;
    const raw = readPersistedValue(draftKey);
    if (!raw) { hydratedOnOpenRef.current = true; return; }
    try {
      const draft = JSON.parse(raw) as Partial<LogPlayDraft>;
      if (typeof draft.playedAt === "string" && draft.playedAt) setPlayedAt(draft.playedAt);
      if (typeof draft.duration === "string") setDuration(draft.duration);
      if (typeof draft.notes === "string") setNotes(draft.notes);
      if (Array.isArray(draft.players) && draft.players.length > 0) setPlayers(draft.players);
      if (Array.isArray(draft.selectedExpansionIds)) setSelectedExpansions(new Set(draft.selectedExpansionIds));
      if (draft.scoringType) setScoringType(draft.scoringType);
      if (draft.cooperativeResult) setCooperativeResult(draft.cooperativeResult);
    } catch {}
    hydratedOnOpenRef.current = true;
  }, [open, draftKey]);

  // Persist draft
  useEffect(() => {
    if (!open || !hydratedOnOpenRef.current) return;
    const draft: LogPlayDraft = {
      playedAt, duration, notes, players,
      selectedExpansionIds: Array.from(selectedExpansions),
      scoringType, cooperativeResult,
    };
    persistValue(draftKey, JSON.stringify(draft));
  }, [open, playedAt, duration, notes, players, selectedExpansions, scoringType, cooperativeResult, draftKey]);

  const toggleExpansion = (expansionId: string) => {
    setSelectedExpansions((prev) => {
      const next = new Set(prev);
      next.has(expansionId) ? next.delete(expansionId) : next.add(expansionId);
      return next;
    });
  };

  const addPlayer = () => setPlayers([...players, defaultPlayer()]);

  const removePlayer = (index: number) => {
    if (players.length > 1) setPlayers(players.filter((_, i) => i !== index));
  };

  const updatePlayer = (index: number, field: keyof PlayerInput, value: any) => {
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

    // For co-op games, set all players as winners/losers based on cooperative_result
    const isCoopWin = scoringType === "cooperative" && cooperativeResult === "win";
    const isCoopLose = scoringType === "cooperative" && cooperativeResult === "lose";

    const input: CreateSessionInput = {
      game_id: gameId,
      played_at: new Date(playedAt).toISOString(),
      duration_minutes: duration ? parseInt(duration, 10) : null,
      notes: notes.trim() || null,
      cooperative_result: scoringType === "cooperative" ? (cooperativeResult || null) : null,
      players: validPlayers.map((p, i) => ({
        player_name: p.name.trim(),
        score: p.score ? parseInt(p.score, 10) : null,
        is_winner: scoringType === "cooperative" ? isCoopWin : p.isWinner,
        is_first_play: p.isFirstPlay,
        color: null,
        linked_user_id: p.linkedUser?.user_id ?? null,
        tag_status: p.linkedUser ? "pending" : "none",
        placement: p.placement ? parseInt(p.placement, 10) : null,
        player_outcome: p.playerOutcome && p.playerOutcome !== "__active" ? p.playerOutcome : null,
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
    setPlayers([defaultPlayer()]);
    setSelectedExpansions(new Set());
    setScoringType(detectedScoringType ?? "highest_wins");
    setCooperativeResult("");
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

          {/* Scoring Type */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Scoring Type
            </Label>
            <Select value={scoringType} onValueChange={(v) => setScoringType(v as ScoringType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SCORING_LABELS) as [ScoringType, string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {detectedScoringType && detectedScoringType !== scoringType && (
              <p className="text-[10px] text-muted-foreground">
                Auto-detected: {SCORING_LABELS[detectedScoringType]}. You can override per session.
              </p>
            )}
          </div>

          {/* Co-op Result */}
          {scoringType === "cooperative" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Handshake className="h-4 w-4" />
                Co-op Result
              </Label>
              <div className="flex gap-2">
                {[
                  { val: "win", label: "🎉 We Won!", cls: "border-green-500/50 bg-green-500/10 text-green-600" },
                  { val: "lose", label: "💀 We Lost", cls: "border-destructive/50 bg-destructive/10 text-destructive" },
                ].map(({ val, label, cls }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCooperativeResult(val)}
                    className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                      cooperativeResult === val ? cls + " ring-2 ring-offset-1 ring-offset-background" : "border-muted bg-muted/20 text-muted-foreground hover:bg-muted/40"
                    }`}
                    style={undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Expansions */}
          <ExpansionPicker
            expansions={expansions}
            selected={selectedExpansions}
            onToggle={toggleExpansion}
            loading={loadingExpansions}
          />

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
                <PlayerScoreInput
                  key={index}
                  player={player}
                  index={index}
                  scoringType={scoringType}
                  canRemove={players.length > 1}
                  onUpdate={updatePlayer}
                  onRemove={removePlayer}
                  onLink={linkUser}
                  onUnlink={unlinkUser}
                />
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
