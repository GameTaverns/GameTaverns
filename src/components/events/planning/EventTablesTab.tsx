import { useState } from "react";
import { Plus, LayoutGrid, Trash2, UserPlus, Users, X, Pencil } from "lucide-react";
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
import { useEventTables, useAddEventTable, useRemoveEventTable, useUpdateEventTable, useTableSeats, useAddTableSeat, useRemoveTableSeat, type EventTable } from "@/hooks/useEventPlanning";

interface EventTablesTabProps {
  eventId: string;
}

export function EventTablesTab({ eventId }: EventTablesTabProps) {
  const { data: tables = [], isLoading } = useEventTables(eventId);
  const addTable = useAddEventTable();
  const removeTable = useRemoveEventTable();
  const updateTable = useUpdateEventTable();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<EventTable | null>(null);

  const [tableLabel, setTableLabel] = useState("");
  const [gameTitle, setGameTitle] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [notes, setNotes] = useState("");

  const resetForm = () => { setTableLabel(""); setGameTitle(""); setCapacity("4"); setNotes(""); };

  const handleAdd = async () => {
    if (!tableLabel.trim()) return;
    await addTable.mutateAsync({
      event_id: eventId,
      table_label: tableLabel.trim(),
      game_id: null,
      game_title: gameTitle.trim() || null,
      capacity: parseInt(capacity) || 4,
      notes: notes.trim() || null,
      display_order: tables.length,
    });
    resetForm();
    setShowAddDialog(false);
  };

  const openEdit = (table: EventTable) => {
    setTableLabel(table.table_label);
    setGameTitle(table.game_title || "");
    setCapacity(table.capacity.toString());
    setNotes(table.notes || "");
    setEditingTable(table);
  };

  const handleEdit = async () => {
    if (!editingTable || !tableLabel.trim()) return;
    await updateTable.mutateAsync({
      tableId: editingTable.id,
      eventId,
      updates: {
        table_label: tableLabel.trim(),
        game_title: gameTitle.trim() || null,
        capacity: parseInt(capacity) || 4,
        notes: notes.trim() || null,
      },
    });
    resetForm();
    setEditingTable(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                Table Assignments
              </CardTitle>
              <CardDescription>Organize players into groups and tables</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Table
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : tables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <LayoutGrid className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tables set up yet</p>
              <p className="text-xs mt-1">Create tables and assign players</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  onEdit={() => openEdit(table)}
                  onRemove={() => removeTable.mutate({ tableId: table.id, eventId })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Table Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(o) => { if (!o) resetForm(); setShowAddDialog(o); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Table / Group</DialogTitle>
          </DialogHeader>
          <TableFormFields
            tableLabel={tableLabel} setTableLabel={setTableLabel}
            gameTitle={gameTitle} setGameTitle={setGameTitle}
            capacity={capacity} setCapacity={setCapacity}
            notes={notes} setNotes={setNotes}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!tableLabel.trim() || addTable.isPending}>
              {addTable.isPending ? "Adding..." : "Add Table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Table Dialog */}
      <Dialog open={!!editingTable} onOpenChange={(o) => { if (!o) { resetForm(); setEditingTable(null); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Table</DialogTitle>
          </DialogHeader>
          <TableFormFields
            tableLabel={tableLabel} setTableLabel={setTableLabel}
            gameTitle={gameTitle} setGameTitle={setGameTitle}
            capacity={capacity} setCapacity={setCapacity}
            notes={notes} setNotes={setNotes}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setEditingTable(null); }}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!tableLabel.trim() || updateTable.isPending}>
              {updateTable.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TableFormFields({
  tableLabel, setTableLabel, gameTitle, setGameTitle, capacity, setCapacity, notes, setNotes,
}: {
  tableLabel: string; setTableLabel: (v: string) => void;
  gameTitle: string; setGameTitle: (v: string) => void;
  capacity: string; setCapacity: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Table Label *</Label>
        <Input value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder="e.g. Table 1, Living Room" />
      </div>
      <div className="space-y-2">
        <Label>Game</Label>
        <Input value={gameTitle} onChange={(e) => setGameTitle(e.target.value)} placeholder="Game being played at this table" />
      </div>
      <div className="space-y-2">
        <Label>Capacity</Label>
        <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} min={1} />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Teaching table, competitive" />
      </div>
    </div>
  );
}

function TableCard({ table, onEdit, onRemove }: { table: EventTable; onEdit: () => void; onRemove: () => void }) {
  const { data: seats = [] } = useTableSeats(table.id);
  const addSeat = useAddTableSeat();
  const removeSeat = useRemoveTableSeat();
  const [newPlayer, setNewPlayer] = useState("");

  const handleAddPlayer = async () => {
    if (!newPlayer.trim()) return;
    await addSeat.mutateAsync({
      table_id: table.id,
      player_name: newPlayer.trim(),
    });
    setNewPlayer("");
  };

  const seatsFilled = seats.length;
  const isFull = seatsFilled >= table.capacity;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{table.table_label}</CardTitle>
            {table.game_title && (
              <p className="text-xs text-muted-foreground mt-0.5">{table.game_title}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={isFull ? "default" : "outline"} className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {seatsFilled}/{table.capacity}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {table.notes && (
          <p className="text-xs text-muted-foreground italic">{table.notes}</p>
        )}
        
        {/* Seated players */}
        <div className="space-y-1">
          {seats.map((seat) => (
            <div key={seat.id} className="flex items-center justify-between text-sm p-1.5 rounded bg-muted/50 group">
              <span>{seat.player_name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => removeSeat.mutate({ seatId: seat.id, tableId: table.id })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add player */}
        {!isFull && (
          <div className="flex items-center gap-2">
            <Input
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              placeholder="Add player..."
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleAddPlayer} disabled={!newPlayer.trim()}>
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
