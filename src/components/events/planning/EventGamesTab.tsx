import { useState } from "react";
import { Plus, Gamepad2, Clock, Users, Trash2, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEventGames, useAddEventGame, useRemoveEventGame, type EventGame } from "@/hooks/useEventPlanning";

interface EventGamesTabProps {
  eventId: string;
  libraryId: string;
}

export function EventGamesTab({ eventId, libraryId }: EventGamesTabProps) {
  const { data: games = [], isLoading } = useEventGames(eventId);
  const addGame = useAddEventGame();
  const removeGame = useRemoveEventGame();
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Add game form state
  const [title, setTitle] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [duration, setDuration] = useState("");
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setTitle(""); setScheduledTime(""); setDuration("");
    setMinPlayers(""); setMaxPlayers(""); setTableLabel(""); setNotes("");
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    await addGame.mutateAsync({
      event_id: eventId,
      game_id: null,
      catalog_game_id: null,
      title: title.trim(),
      image_url: null,
      scheduled_time: scheduledTime || null,
      duration_minutes: duration ? parseInt(duration) : null,
      min_players: minPlayers ? parseInt(minPlayers) : null,
      max_players: maxPlayers ? parseInt(maxPlayers) : null,
      table_label: tableLabel || null,
      notes: notes || null,
      display_order: games.length,
    });
    resetForm();
    setShowAddDialog(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-primary" />
                Game Lineup
              </CardTitle>
              <CardDescription>Schedule which games will be played and when</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Game
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : games.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gamepad2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No games scheduled yet</p>
              <p className="text-xs mt-1">Add games to build your lineup</p>
            </div>
          ) : (
            <div className="space-y-2">
              {games.map((game) => (
                <GameLineupItem
                  key={game.id}
                  game={game}
                  onRemove={() => removeGame.mutate({ gameId: game.id, eventId })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Game Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Game to Lineup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Game Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Catan" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Players</Label>
                <Input type="number" value={minPlayers} onChange={(e) => setMinPlayers(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Max Players</Label>
                <Input type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Table / Group</Label>
              <Input value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder="e.g. Table 1" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Teaching session, bring expansion, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!title.trim() || addGame.isPending}>
              {addGame.isPending ? "Adding..." : "Add Game"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GameLineupItem({ game, onRemove }: { game: EventGame; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group">
      <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{game.title}</span>
          {game.table_label && (
            <Badge variant="outline" className="text-xs">{game.table_label}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {game.scheduled_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {game.scheduled_time}
            </span>
          )}
          {game.duration_minutes && (
            <span>{game.duration_minutes} min</span>
          )}
          {(game.min_players || game.max_players) && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {game.min_players && game.max_players
                ? `${game.min_players}–${game.max_players}`
                : game.min_players
                  ? `${game.min_players}+`
                  : `Up to ${game.max_players}`}
            </span>
          )}
          {game.notes && <span className="truncate">{game.notes}</span>}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
