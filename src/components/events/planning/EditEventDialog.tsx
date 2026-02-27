import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventDetail } from "@/hooks/useEventPlanning";
import { useUpdateEventDetail } from "@/hooks/useEventPlanning";

interface EditEventDialogProps {
  event: EventDetail;
}

export function EditEventDialog({ event }: EditEventDialogProps) {
  const [open, setOpen] = useState(false);
  const updateEvent = useUpdateEventDetail();

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || "");
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [eventLocation, setEventLocation] = useState(event.event_location || "");
  const [eventType, setEventType] = useState(event.event_type);
  const [maxAttendees, setMaxAttendees] = useState(event.max_attendees?.toString() || "");
  const [isPublic, setIsPublic] = useState(event.is_public);
  const [venueName, setVenueName] = useState(event.venue_name || "");
  const [venueAddress, setVenueAddress] = useState(event.venue_address || "");
  const [venueNotes, setVenueNotes] = useState(event.venue_notes || "");
  const [entryFee, setEntryFee] = useState(event.entry_fee || "");
  const [ageRestriction, setAgeRestriction] = useState(event.age_restriction || "");
  const [parkingInfo, setParkingInfo] = useState(event.parking_info || "");

  // Format dates for datetime-local input
  useEffect(() => {
    if (open) {
      setTitle(event.title);
      setDescription(event.description || "");
      setEventDate(formatForInput(event.event_date));
      setEndDate(event.end_date ? formatForInput(event.end_date) : "");
      setEventLocation(event.event_location || "");
      setEventType(event.event_type);
      setMaxAttendees(event.max_attendees?.toString() || "");
      setIsPublic(event.is_public);
      setVenueName(event.venue_name || "");
      setVenueAddress(event.venue_address || "");
      setVenueNotes(event.venue_notes || "");
      setEntryFee(event.entry_fee || "");
      setAgeRestriction(event.age_restriction || "");
      setParkingInfo(event.parking_info || "");
    }
  }, [open, event]);

  function formatForInput(dateStr: string) {
    try {
      return format(new Date(dateStr), "yyyy-MM-dd'T'HH:mm");
    } catch {
      return "";
    }
  }

  function handleSave() {
    const updates: Record<string, any> = {
      title,
      description: description || null,
      event_date: eventDate ? new Date(eventDate).toISOString() : event.event_date,
      end_date: endDate ? new Date(endDate).toISOString() : null,
      event_location: eventLocation || null,
      event_type: eventType,
      max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
      is_public: isPublic,
      venue_name: venueName || null,
      venue_address: venueAddress || null,
      venue_notes: venueNotes || null,
      entry_fee: entryFee || null,
      age_restriction: ageRestriction || null,
      parking_info: parkingInfo || null,
    };

    updateEvent.mutate(
      { eventId: event.id, updates },
      { onSuccess: () => setOpen(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Edit Event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea id="edit-desc" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>

          {/* Event Type */}
          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="game_night">Game Night</SelectItem>
                <SelectItem value="tournament">Tournament</SelectItem>
                <SelectItem value="convention">Convention</SelectItem>
                <SelectItem value="meetup">Meetup</SelectItem>
                <SelectItem value="public_event">Public Event</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">Start Date/Time</Label>
              <Input id="edit-start" type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">End Date/Time</Label>
              <Input id="edit-end" type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Venue */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-venue">Venue Name</Label>
              <Input id="edit-venue" value={venueName} onChange={e => setVenueName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-addr">Address</Label>
              <Input id="edit-addr" value={venueAddress} onChange={e => setVenueAddress(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-loc">Location (general)</Label>
            <Input id="edit-loc" value={eventLocation} onChange={e => setEventLocation(e.target.value)} placeholder="e.g. Downtown, Room 2B" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-vnotes">Venue Notes</Label>
            <Textarea id="edit-vnotes" value={venueNotes} onChange={e => setVenueNotes(e.target.value)} rows={2} placeholder="Accessibility, entrance info..." />
          </div>

          {/* Capacity & Visibility */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cap">Max Attendees</Label>
              <Input id="edit-cap" type="number" min={0} value={maxAttendees} onChange={e => setMaxAttendees(e.target.value)} placeholder="No limit" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} id="edit-public" />
              <Label htmlFor="edit-public">Public event</Label>
            </div>
          </div>

          {/* Extra details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-fee">Entry Fee</Label>
              <Input id="edit-fee" value={entryFee} onChange={e => setEntryFee(e.target.value)} placeholder="Free" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-age">Age Restriction</Label>
              <Input id="edit-age" value={ageRestriction} onChange={e => setAgeRestriction(e.target.value)} placeholder="All ages" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-park">Parking Info</Label>
            <Input id="edit-park" value={parkingInfo} onChange={e => setParkingInfo(e.target.value)} placeholder="Street parking available" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || updateEvent.isPending}>
            {updateEvent.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
