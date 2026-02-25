import { useState } from "react";
import { Plus, Users, Heart, Package, Trash2, MessageSquare, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useEventAttendeePrefs,
  useSubmitAttendeePref,
  type EventAttendeePref,
} from "@/hooks/useEventPlanning";

interface EventAttendeesTabProps {
  eventId: string;
}

export function EventAttendeesTab({ eventId }: EventAttendeesTabProps) {
  const { data: prefs = [], isLoading } = useEventAttendeePrefs(eventId);
  const submitPref = useSubmitAttendeePref();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [name, setName] = useState("");
  const [wantsToPlay, setWantsToPlay] = useState("");
  const [canBring, setCanBring] = useState("");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setName("");
    setWantsToPlay("");
    setCanBring("");
    setDietaryNotes("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await submitPref.mutateAsync({
      event_id: eventId,
      attendee_identifier: name.trim().toLowerCase(),
      attendee_name: name.trim(),
      wants_to_play: wantsToPlay
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      can_bring: canBring
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      dietary_notes: dietaryNotes.trim() || undefined,
      notes: notes.trim() || undefined,
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
                <Users className="h-4 w-4 text-primary" />
                Attendee Preferences
              </CardTitle>
              <CardDescription>
                {prefs.length > 0
                  ? `${prefs.length} attendee${prefs.length !== 1 ? "s" : ""} responded`
                  : "Attendees can share what games they want to play and what they can bring"}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Preferences
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : prefs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No preferences submitted yet</p>
              <p className="text-xs mt-1">
                Share what you want to play and what you can bring
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {prefs.map((pref) => (
                <AttendeeCard key={pref.id} pref={pref} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Game Wish Summary */}
      {prefs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              Most Requested Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GameRequestSummary prefs={prefs} />
          </CardContent>
        </Card>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Your Preferences</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
              />
            </div>
            <div className="space-y-2">
              <Label>Games You Want to Play</Label>
              <Input
                value={wantsToPlay}
                onChange={(e) => setWantsToPlay(e.target.value)}
                placeholder="Catan, Wingspan, Azul (comma-separated)"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple games with commas
              </p>
            </div>
            <div className="space-y-2">
              <Label>Games You Can Bring</Label>
              <Input
                value={canBring}
                onChange={(e) => setCanBring(e.target.value)}
                placeholder="Ticket to Ride, Codenames (comma-separated)"
              />
            </div>
            <div className="space-y-2">
              <Label>Dietary Notes / Allergies</Label>
              <Input
                value={dietaryNotes}
                onChange={(e) => setDietaryNotes(e.target.value)}
                placeholder="Vegetarian, nut allergy, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Other Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Arriving late, need a ride, etc."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || submitPref.isPending}
            >
              {submitPref.isPending ? "Saving..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttendeeCard({ pref }: { pref: EventAttendeePref }) {
  const wantsToPlay = Array.isArray(pref.wants_to_play) ? pref.wants_to_play : [];
  const canBring = Array.isArray(pref.can_bring) ? pref.can_bring : [];

  return (
    <div className="p-3 rounded-lg border bg-card space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">
          {pref.attendee_name || pref.attendee_identifier}
        </span>
      </div>

      {wantsToPlay.length > 0 && (
        <div className="flex items-start gap-2">
          <Heart className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <div className="flex flex-wrap gap-1">
            {wantsToPlay.map((g, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {g}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {canBring.length > 0 && (
        <div className="flex items-start gap-2">
          <Package className="h-3.5 w-3.5 text-accent-foreground mt-0.5 shrink-0" />
          <div className="flex flex-wrap gap-1">
            {canBring.map((g, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {g}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {pref.dietary_notes && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UtensilsCrossed className="h-3 w-3 shrink-0" />
          <span>{pref.dietary_notes}</span>
        </div>
      )}

      {pref.notes && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3 shrink-0" />
          <span>{pref.notes}</span>
        </div>
      )}
    </div>
  );
}

function GameRequestSummary({ prefs }: { prefs: EventAttendeePref[] }) {
  const gameCounts: Record<string, number> = {};
  prefs.forEach((p) => {
    const wtp = Array.isArray(p.wants_to_play) ? p.wants_to_play : [];
    wtp.forEach((g) => {
      const key = g.toLowerCase().trim();
      if (key) gameCounts[key] = (gameCounts[key] || 0) + 1;
    });
  });

  const sorted = Object.entries(gameCounts).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No game preferences submitted yet
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {sorted.map(([game, count]) => (
        <div
          key={game}
          className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
        >
          <span className="capitalize">{game}</span>
          <Badge variant="secondary" className="text-xs">
            {count} {count === 1 ? "request" : "requests"}
          </Badge>
        </div>
      ))}
    </div>
  );
}
