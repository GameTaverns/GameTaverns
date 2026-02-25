import { useState } from "react";
import { Plus, UserPlus, UserMinus, Users, Clock, AlertCircle, Trash2, Mail } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useEventRegistrations,
  useRegisterForEvent,
  useCancelRegistration,
  useRemoveRegistration,
  type EventRegistration,
} from "@/hooks/useEventRegistrations";

interface EventRegistrationTabProps {
  eventId: string;
  maxAttendees: number | null;
}

export function EventRegistrationTab({ eventId, maxAttendees }: EventRegistrationTabProps) {
  const { data: registrations = [], isLoading } = useEventRegistrations(eventId);
  const register = useRegisterForEvent();
  const cancelReg = useCancelRegistration();
  const removeReg = useRemoveRegistration();
  const [showRegDialog, setShowRegDialog] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const registered = registrations.filter(r => r.status === "registered");
  const waitlisted = registrations.filter(r => r.status === "waitlisted");
  const cancelled = registrations.filter(r => r.status === "cancelled");

  const handleRegister = async () => {
    if (!name.trim()) return;
    await register.mutateAsync({
      event_id: eventId,
      attendee_name: name.trim(),
      attendee_email: email.trim() || undefined,
      max_attendees: maxAttendees,
      notes: notes.trim() || undefined,
    });
    setName(""); setEmail(""); setNotes("");
    setShowRegDialog(false);
  };

  const capacityPercent = maxAttendees ? Math.min(100, (registered.length / maxAttendees) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Registration
              </CardTitle>
              <CardDescription>
                {registered.length} registered
                {maxAttendees ? ` / ${maxAttendees} spots` : ""}
                {waitlisted.length > 0 ? ` • ${waitlisted.length} waitlisted` : ""}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowRegDialog(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Register
            </Button>
          </div>

          {maxAttendees && (
            <div className="mt-3 space-y-1">
              <Progress value={capacityPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{registered.length} of {maxAttendees}</span>
                {maxAttendees - registered.length > 0 ? (
                  <span className="text-primary">{maxAttendees - registered.length} spots left</span>
                ) : (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Full — waitlist active
                  </span>
                )}
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : registrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No registrations yet</p>
              <p className="text-xs mt-1">Be the first to register!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Registered */}
              {registered.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Registered ({registered.length})
                  </h4>
                  <div className="space-y-1">
                    {registered.map(reg => (
                      <RegistrationRow
                        key={reg.id}
                        reg={reg}
                        onCancel={() => cancelReg.mutate({ registrationId: reg.id, eventId })}
                        onRemove={() => removeReg.mutate({ registrationId: reg.id, eventId })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Waitlisted */}
              {waitlisted.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Waitlist ({waitlisted.length})
                  </h4>
                  <div className="space-y-1">
                    {waitlisted.map(reg => (
                      <RegistrationRow
                        key={reg.id}
                        reg={reg}
                        onCancel={() => cancelReg.mutate({ registrationId: reg.id, eventId })}
                        onRemove={() => removeReg.mutate({ registrationId: reg.id, eventId })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Cancelled */}
              {cancelled.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Cancelled ({cancelled.length})
                  </h4>
                  <div className="space-y-1 opacity-60">
                    {cancelled.map(reg => (
                      <RegistrationRow
                        key={reg.id}
                        reg={reg}
                        onRemove={() => removeReg.mutate({ registrationId: reg.id, eventId })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRegDialog} onOpenChange={setShowRegDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Register for Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label>Email (optional)</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="For event updates" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Arriving late, bringing +1" />
            </div>
            {maxAttendees && registered.length >= maxAttendees && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                <span>This event is full. You'll be added to the waitlist.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegDialog(false)}>Cancel</Button>
            <Button onClick={handleRegister} disabled={!name.trim() || register.isPending}>
              {register.isPending ? "Registering..." : maxAttendees && registered.length >= maxAttendees ? "Join Waitlist" : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegistrationRow({
  reg,
  onCancel,
  onRemove,
}: {
  reg: EventRegistration;
  onCancel?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-md border bg-card group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${reg.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
            {reg.attendee_name}
          </span>
          {reg.status === "waitlisted" && reg.waitlist_position && (
            <Badge variant="outline" className="text-xs text-amber-600">#{reg.waitlist_position}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          {reg.attendee_email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />{reg.attendee_email}
            </span>
          )}
          <span>{format(new Date(reg.registered_at), "MMM d, h:mm a")}</span>
          {reg.notes && <span className="truncate">· {reg.notes}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {onCancel && reg.status !== "cancelled" && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            <UserMinus className="h-3 w-3 mr-1" /> Cancel
          </Button>
        )}
        {onRemove && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
