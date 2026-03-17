import { useState, useMemo } from "react";
import { Plus, Gamepad2, Clock, Users, Trash2, GripVertical, Pencil, Search, Star } from "lucide-react";
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
import { useEventGames, useAddEventGame, useRemoveEventGame, useUpdateEventGame, type EventGame } from "@/hooks/useEventPlanning";
import { useCatalogGameSearch, type CatalogSearchResult } from "@/hooks/useCatalogGameSearch";
import { GameImage } from "@/components/games/GameImage";

import { useEventRegistrations } from "@/hooks/useEventRegistrations";

interface EventGamesTabProps {
  eventId: string;
  libraryId: string;
}

export function EventGamesTab({ eventId, libraryId }: EventGamesTabProps) {
  const { data: games = [], isLoading } = useEventGames(eventId);
  const { data: registrations = [] } = useEventRegistrations(eventId);
  const addGame = useAddEventGame();
  const removeGame = useRemoveEventGame();
  const updateGame = useUpdateEventGame();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingGame, setEditingGame] = useState<EventGame | null>(null);

  // Add game form state
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [catalogGameId, setCatalogGameId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [duration, setDuration] = useState("");
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setTitle(""); setImageUrl(null); setCatalogGameId(null); setDescription("");
    setScheduledTime(""); setDuration("");
    setMinPlayers(""); setMaxPlayers(""); setTableLabel(""); setNotes("");
  };

  const populateForm = (game: EventGame) => {
    setTitle(game.title);
    setImageUrl(game.image_url);
    setCatalogGameId(game.catalog_game_id);
    setDescription(game.description || "");
    setScheduledTime(game.scheduled_time || "");
    setDuration(game.duration_minutes?.toString() || "");
    setMinPlayers(game.min_players?.toString() || "");
    setMaxPlayers(game.max_players?.toString() || "");
    setTableLabel(game.table_label || "");
    setNotes(game.notes || "");
  };

  const handleSelectCatalogGame = (game: CatalogSearchResult) => {
    setTitle(game.title);
    setImageUrl(game.image_url);
    setCatalogGameId(game.id);
    if (game.min_players) setMinPlayers(game.min_players.toString());
    if (game.max_players) setMaxPlayers(game.max_players.toString());
    if (game.description) setDescription(game.description.slice(0, 300));
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    await addGame.mutateAsync({
      event_id: eventId,
      game_id: null,
      catalog_game_id: catalogGameId,
      title: title.trim(),
      description: description || null,
      image_url: imageUrl,
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

  const handleEdit = async () => {
    if (!editingGame || !title.trim()) return;
    await updateGame.mutateAsync({
      gameId: editingGame.id,
      eventId,
      updates: {
        title: title.trim(),
        description: description || null,
        image_url: imageUrl,
        catalog_game_id: catalogGameId,
        scheduled_time: scheduledTime || null,
        duration_minutes: duration ? parseInt(duration) : null,
        min_players: minPlayers ? parseInt(minPlayers) : null,
        max_players: maxPlayers ? parseInt(maxPlayers) : null,
        table_label: tableLabel || null,
        notes: notes || null,
      },
    });
    resetForm();
    setEditingGame(null);
  };

  const openEdit = (game: EventGame) => {
    populateForm(game);
    setEditingGame(game);
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
                  onEdit={() => openEdit(game)}
                  onRemove={() => removeGame.mutate({ gameId: game.id, eventId })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Game Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(o) => { if (!o) resetForm(); setShowAddDialog(o); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Game to Lineup</DialogTitle>
          </DialogHeader>
          <GameFormFields
            title={title} setTitle={setTitle}
            scheduledTime={scheduledTime} setScheduledTime={setScheduledTime}
            duration={duration} setDuration={setDuration}
            minPlayers={minPlayers} setMinPlayers={setMinPlayers}
            maxPlayers={maxPlayers} setMaxPlayers={setMaxPlayers}
            tableLabel={tableLabel} setTableLabel={setTableLabel}
            notes={notes} setNotes={setNotes}
            onSelectCatalogGame={handleSelectCatalogGame}
            imageUrl={imageUrl}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!title.trim() || addGame.isPending}>
              {addGame.isPending ? "Adding..." : "Add Game"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Game Dialog */}
      <Dialog open={!!editingGame} onOpenChange={(o) => { if (!o) { resetForm(); setEditingGame(null); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Game</DialogTitle>
          </DialogHeader>
          <GameFormFields
            title={title} setTitle={setTitle}
            scheduledTime={scheduledTime} setScheduledTime={setScheduledTime}
            duration={duration} setDuration={setDuration}
            minPlayers={minPlayers} setMinPlayers={setMinPlayers}
            maxPlayers={maxPlayers} setMaxPlayers={setMaxPlayers}
            tableLabel={tableLabel} setTableLabel={setTableLabel}
            notes={notes} setNotes={setNotes}
            onSelectCatalogGame={handleSelectCatalogGame}
            imageUrl={imageUrl}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setEditingGame(null); }}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!title.trim() || updateGame.isPending}>
              {updateGame.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GameFormFields({
  title, setTitle, scheduledTime, setScheduledTime, duration, setDuration,
  minPlayers, setMinPlayers, maxPlayers, setMaxPlayers, tableLabel, setTableLabel,
  notes, setNotes, onSelectCatalogGame, imageUrl,
}: {
  title: string; setTitle: (v: string) => void;
  scheduledTime: string; setScheduledTime: (v: string) => void;
  duration: string; setDuration: (v: string) => void;
  minPlayers: string; setMinPlayers: (v: string) => void;
  maxPlayers: string; setMaxPlayers: (v: string) => void;
  tableLabel: string; setTableLabel: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  onSelectCatalogGame: (game: CatalogSearchResult) => void;
  imageUrl: string | null;
}) {
  const { searchTerm, handleSearch, results, isLoading } = useCatalogGameSearch(3);
  const [showResults, setShowResults] = useState(false);

  return (
    <div className="space-y-4">
      {/* Catalog Search */}
      <div className="space-y-2">
        <Label>Search Catalog</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => { handleSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder="Search our game catalog..."
            className="pl-8 h-9 text-sm"
          />
        </div>
        {showResults && searchTerm.length >= 3 && (
          <div className="max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
            {isLoading && <div className="p-2 text-xs text-muted-foreground text-center">Searching...</div>}
            {!isLoading && results.length === 0 && (
              <div className="p-2 text-xs text-muted-foreground text-center">No results</div>
            )}
              {results.map(game => (
              <button
                key={game.id}
                type="button"
                className="w-full flex items-start gap-2 p-2 hover:bg-muted/50 transition-colors text-left"
                onClick={() => { onSelectCatalogGame(game); setShowResults(false); handleSearch(""); }}
              >
                {game.image_url ? (
                  <GameImage imageUrl={game.image_url} alt={game.title} className="h-10 w-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{game.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {game.year_published || ""}
                    {game.min_players && game.max_players ? ` · ${game.min_players}–${game.max_players}p` : ""}
                  </p>
                  {game.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{game.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected game preview */}
      {imageUrl && (
        <div className="flex items-center gap-3 p-2 rounded-md border bg-muted/30">
          <GameImage imageUrl={imageUrl} alt={title} className="h-12 w-12 rounded object-cover" />
          <span className="text-sm font-medium">{title}</span>
        </div>
      )}

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
  );
}

function GameLineupItem({ game, onEdit, onRemove }: { game: EventGame; onEdit: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group">
      {/* Thumbnail */}
      {game.image_url ? (
        <GameImage
          imageUrl={game.image_url}
          alt={game.title}
          className="h-14 w-14 rounded-md object-cover shrink-0"
        />
      ) : (
        <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Gamepad2 className="h-5 w-5 text-muted-foreground/50" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{game.title}</span>
          {game.table_label && (
            <Badge variant="outline" className="text-xs">{game.table_label}</Badge>
          )}
        </div>
        {game.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{game.description}</p>
        )}
        {game.notes && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 italic line-clamp-1">{game.notes}</p>
        )}
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
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
