import { useState, useMemo } from "react";
import { Users, Clock, AlertCircle, UserPlus, UserMinus, Trash2, Mail, Crown, Package, MessageSquare, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
import { useEventDetail } from "@/hooks/useEventPlanning";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

const db = supabase as any;

interface EventAttendeesTabProps {
  eventId: string;
  maxAttendees?: number | null;
}

function useEventCreatorProfile(creatorUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["event-creator-profile", creatorUserId],
    queryFn: async () => {
      if (!creatorUserId) return null;
      const { data, error } = await db
        .from("user_profiles")
        .select("user_id, display_name, username")
        .eq("user_id", creatorUserId)
        .maybeSingle();
      if (error) throw error;
      return data as { user_id: string; display_name: string | null; username: string | null } | null;
    },
    enabled: !!creatorUserId,
    staleTime: 60_000,
  });
}

export function EventAttendeesTab({ eventId, maxAttendees }: EventAttendeesTabProps) {
  const { data: registrations = [], isLoading } = useEventRegistrations(eventId);
  const { data: event } = useEventDetail(eventId);
  const creatorId = event?.created_by_user_id || event?.created_by;
  const { data: creatorProfile } = useEventCreatorProfile(creatorId);

  // Batch-fetch primary libraries for all attendee user IDs
  const attendeeUserIds = useMemo(() => {
    const ids = registrations
      .filter(r => r.attendee_user_id)
      .map(r => r.attendee_user_id!);
    if (creatorId) ids.push(creatorId);
    return [...new Set(ids)];
  }, [registrations, creatorId]);

  const { data: attendeeLibraries = {} } = useQuery({
    queryKey: ["attendee-libraries", attendeeUserIds],
    queryFn: async () => {
      if (attendeeUserIds.length === 0) return {};
      const { data, error } = await db
        .from("libraries")
        .select("id, name, slug, owner_id")
        .in("owner_id", attendeeUserIds);
      if (error) throw error;
      const map: Record<string, { name: string; slug: string }> = {};
      for (const lib of data || []) {
        if (!map[lib.owner_id]) {
          map[lib.owner_id] = { name: lib.name, slug: lib.slug };
        }
      }
      return map;
    },
    enabled: attendeeUserIds.length > 0,
    staleTime: 60_000,
  });
  const register = useRegisterForEvent();
  const cancelReg = useCancelRegistration();
  const removeReg = useRemoveRegistration();
  const [showRegDialog, setShowRegDialog] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [bringingText, setBringingText] = useState("");
  const [guestCount, setGuestCount] = useState(0);

  const registered = registrations.filter(r => r.status === "registered");
  const waitlisted = registrations.filter(r => r.status === "waitlisted");
  const cancelled = registrations.filter(r => r.status === "cancelled");
  const creatorIsRegistered = creatorId && registrations.some(r => r.attendee_user_id === creatorId);

  // Count total including plus-ones
  const totalHeadcount = registered.reduce((sum, r) => sum + 1 + (r.guest_count || 0), 0)
    + (creatorId && !creatorIsRegistered ? 1 : 0);
  const totalRegistered = registered.length + (creatorId && !creatorIsRegistered ? 1 : 0);
  const capacityPercent = maxAttendees ? Math.min(100, (totalRegistered / maxAttendees) * 100) : 0;

  const handleRegister = async () => {
    if (!name.trim()) return;
    await register.mutateAsync({
      event_id: eventId,
      attendee_name: name.trim(),
      attendee_email: email.trim() || undefined,
      max_attendees: maxAttendees,
      notes: notes.trim() || undefined,
      bringing_text: bringingText.trim() || undefined,
      guest_count: guestCount,
    });
    setName(""); setEmail(""); setNotes(""); setBringingText(""); setGuestCount(0);
    setShowRegDialog(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Attendees & Registration
              </CardTitle>
              <CardDescription>
                {totalRegistered} registered
                {totalHeadcount > totalRegistered ? ` (${totalHeadcount} total w/ guests)` : ""}
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
                <span>{totalRegistered} of {maxAttendees}</span>
                {maxAttendees - totalRegistered > 0 ? (
                  <span className="text-primary">{maxAttendees - totalRegistered} spots left</span>
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
          ) : totalRegistered === 0 && waitlisted.length === 0 && cancelled.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No attendees yet</p>
              <p className="text-xs mt-1">Share the event or register someone above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Registered */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Registered ({totalRegistered})
                </h4>
                <div className="space-y-1">
                  {creatorId && !creatorIsRegistered && (
                    <div className="flex items-center gap-3 p-2 rounded-md border bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {creatorProfile?.display_name || creatorProfile?.username || "Event Creator"}
                          </span>
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Crown className="h-3 w-3" /> Host
                          </Badge>
                          {creatorId && attendeeLibraries[creatorId] && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  to={`/libraries/${attendeeLibraries[creatorId].slug}`}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <BookOpen className="h-3.5 w-3.5" />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Browse {attendeeLibraries[creatorId].name}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Event organizer</p>
                      </div>
                    </div>
                  )}
                  {registered.map(reg => (
                    <RegistrationRow
                      key={reg.id}
                      reg={reg}
                      isCreator={reg.attendee_user_id === creatorId}
                      library={reg.attendee_user_id ? attendeeLibraries[reg.attendee_user_id] : undefined}
                      onCancel={() => cancelReg.mutate({ registrationId: reg.id, eventId })}
                      onRemove={() => removeReg.mutate({ registrationId: reg.id, eventId })}
                    />
                  ))}
                </div>
              </div>

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
                        library={reg.attendee_user_id ? attendeeLibraries[reg.attendee_user_id] : undefined}
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

      {/* Register Dialog */}
      <Dialog open={showRegDialog} onOpenChange={setShowRegDialog}>
        <DialogContent className="sm:max-w-[425px]">
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
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-2">
                <Label>Bringing (optional)</Label>
                <Input value={bringingText} onChange={e => setBringingText(e.target.value)} placeholder="Snacks, drinks, a game..." />
              </div>
              <div className="space-y-2">
                <Label>Plus-ones</Label>
                <Input
                  type="number" min={0} max={10}
                  value={guestCount}
                  onChange={e => setGuestCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Arriving late, dietary needs, etc." rows={2} />
            </div>
            {maxAttendees && totalRegistered >= maxAttendees && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                <span>This event is full. You'll be added to the waitlist.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegDialog(false)}>Cancel</Button>
            <Button onClick={handleRegister} disabled={!name.trim() || register.isPending}>
              {register.isPending ? "Registering..." : maxAttendees && totalRegistered >= maxAttendees ? "Join Waitlist" : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegistrationRow({
  reg,
  isCreator,
  library,
  onCancel,
  onRemove,
}: {
  reg: EventRegistration;
  isCreator?: boolean;
  library?: { name: string; slug: string };
  onCancel?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-md border bg-card group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${reg.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
            {reg.attendee_name}
          </span>
          {isCreator && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Crown className="h-3 w-3" /> Host
            </Badge>
          )}
          {library && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={`/libraries/${library.slug}`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Browse {library.name}
              </TooltipContent>
            </Tooltip>
          )}
          {reg.guest_count > 0 && (
            <Badge variant="outline" className="text-xs">+{reg.guest_count}</Badge>
          )}
          {reg.status === "waitlisted" && reg.waitlist_position && (
            <Badge variant="outline" className="text-xs text-amber-600">#{reg.waitlist_position}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
          {reg.attendee_email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />{reg.attendee_email}
            </span>
          )}
          <span>{format(new Date(reg.registered_at), "MMM d, h:mm a")}</span>
        </div>
        {/* Extra details row */}
        {(reg.bringing_text || reg.notes) && (
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {reg.bringing_text && (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3 shrink-0" /> {reg.bringing_text}
              </span>
            )}
            {reg.notes && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3 shrink-0" /> {reg.notes}
              </span>
            )}
          </div>
        )}
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
