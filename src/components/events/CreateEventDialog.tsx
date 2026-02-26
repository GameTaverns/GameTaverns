import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, MapPin, Clock, Globe, Lock, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCreateEvent, useUpdateEvent, CalendarEvent } from "@/hooks/useLibraryEvents";
import { useAuth } from "@/hooks/useAuth";

const EVENT_TYPES = [
  { value: "game_night", label: "Game Night" },
  { value: "tournament", label: "Tournament" },
  { value: "convention", label: "Convention" },
  { value: "meetup", label: "Meetup" },
  { value: "public_event", label: "Public Event" },
];

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryId?: string;
  editEvent?: CalendarEvent | null;
}

interface EventDraft {
  activeTab: string;
  title: string;
  description: string;
  eventType: string;
  date: string | null;
  time: string;
  endDate: string | null;
  endTime: string;
  location: string;
  isPublic: boolean;
  maxAttendees: string;
  venueName: string;
  venueAddress: string;
  venueNotes: string;
  entryFee: string;
  ageRestriction: string;
  parkingInfo: string;
  locationCity: string;
  locationRegion: string;
  locationCountry: string;
}

const getDraftKey = (libraryId?: string) => `create_event_dialog_draft:${libraryId || "public"}`;

function readDraft(draftKey: string): EventDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey) || localStorage.getItem(draftKey);
    if (!raw) return null;
    return JSON.parse(raw) as EventDraft;
  } catch {
    return null;
  }
}

function writeDraft(draftKey: string, draft: EventDraft) {
  try {
    const serialized = JSON.stringify(draft);
    sessionStorage.setItem(draftKey, serialized);
    localStorage.setItem(draftKey, serialized);
  } catch {
    // Ignore storage errors
  }
}

function clearDraft(draftKey: string) {
  try {
    sessionStorage.removeItem(draftKey);
    localStorage.removeItem(draftKey);
  } catch {
    // Ignore storage errors
  }
}

export function CreateEventDialog({ open, onOpenChange, libraryId, editEvent }: CreateEventDialogProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("basics");
  
  // Basic fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("game_night");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("19:00");
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [isPublic, setIsPublic] = useState(!libraryId); // Default public for standalone
  const [maxAttendees, setMaxAttendees] = useState("");
  
  // Venue & Logistics
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueNotes, setVenueNotes] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [ageRestriction, setAgeRestriction] = useState("");
  const [parkingInfo, setParkingInfo] = useState("");

  // Location fields for standalone events
  const [locationCity, setLocationCity] = useState("");
  const [locationRegion, setLocationRegion] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  
  const isEditMode = !!editEvent;
  const isStandalone = !libraryId;
  const draftKey = getDraftKey(libraryId);
  
  useEffect(() => {
    if (!open) return;

    if (editEvent) {
      setTitle(editEvent.title);
      setDescription(editEvent.description || "");
      setLocation(editEvent.event_location || "");
      const eventDate = new Date(editEvent.event_date);
      setDate(eventDate);
      setTime(format(eventDate, "HH:mm"));
      setEndDate(undefined);
      setEndTime("");
      setActiveTab("basics");
      return;
    }

    const draft = readDraft(draftKey);
    if (!draft) return;

    setActiveTab(draft.activeTab || "basics");
    setTitle(draft.title || "");
    setDescription(draft.description || "");
    setEventType(draft.eventType || "game_night");
    setDate(draft.date ? new Date(draft.date) : undefined);
    setTime(draft.time || "19:00");
    setEndDate(draft.endDate ? new Date(draft.endDate) : undefined);
    setEndTime(draft.endTime || "");
    setLocation(draft.location || "");
    setIsPublic(draft.isPublic ?? !libraryId);
    setMaxAttendees(draft.maxAttendees || "");
    setVenueName(draft.venueName || "");
    setVenueAddress(draft.venueAddress || "");
    setVenueNotes(draft.venueNotes || "");
    setEntryFee(draft.entryFee || "");
    setAgeRestriction(draft.ageRestriction || "");
    setParkingInfo(draft.parkingInfo || "");
    setLocationCity(draft.locationCity || "");
    setLocationRegion(draft.locationRegion || "");
    setLocationCountry(draft.locationCountry || "");
  }, [editEvent, open, libraryId, draftKey]);

  useEffect(() => {
    if (!open || isEditMode) return;

    writeDraft(draftKey, {
      activeTab,
      title,
      description,
      eventType,
      date: date ? date.toISOString() : null,
      time,
      endDate: endDate ? endDate.toISOString() : null,
      endTime,
      location,
      isPublic,
      maxAttendees,
      venueName,
      venueAddress,
      venueNotes,
      entryFee,
      ageRestriction,
      parkingInfo,
      locationCity,
      locationRegion,
      locationCountry,
    });
  }, [
    open,
    isEditMode,
    draftKey,
    activeTab,
    title,
    description,
    eventType,
    date,
    time,
    endDate,
    endTime,
    location,
    isPublic,
    maxAttendees,
    venueName,
    venueAddress,
    venueNotes,
    entryFee,
    ageRestriction,
    parkingInfo,
    locationCity,
    locationRegion,
    locationCountry,
  ]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    
    const [hours, minutes] = time.split(":").map(Number);
    const eventDate = new Date(date);
    eventDate.setHours(hours, minutes, 0, 0);

    let endDateISO: string | undefined;
    if (endDate) {
      const ed = new Date(endDate);
      if (endTime) {
        const [eh, em] = endTime.split(":").map(Number);
        ed.setHours(eh, em, 0, 0);
      } else {
        ed.setHours(23, 59, 0, 0);
      }
      endDateISO = ed.toISOString();
    }
    
    if (isEditMode && editEvent) {
      await updateEvent.mutateAsync({
        eventId: editEvent.id,
        libraryId: libraryId || "",
        updates: {
          title: title.trim(),
          description: description.trim() || null,
          event_date: eventDate.toISOString(),
          event_location: location.trim() || venueName.trim() || null,
        },
      });
    } else {
      await createEvent.mutateAsync({
        library_id: libraryId || undefined,
        created_by_user_id: isStandalone ? user?.id : undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        event_date: eventDate.toISOString(),
        event_location: location.trim() || venueAddress.trim() || undefined,
        event_type: eventType,
        end_date: endDateISO,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : undefined,
        is_public: isPublic,
        venue_name: venueName.trim() || undefined,
        venue_address: venueAddress.trim() || undefined,
        venue_notes: venueNotes.trim() || undefined,
        entry_fee: entryFee.trim() || undefined,
        age_restriction: ageRestriction.trim() || undefined,
        parking_info: parkingInfo.trim() || undefined,
        location_city: locationCity.trim() || undefined,
        location_region: locationRegion.trim() || undefined,
        location_country: locationCountry.trim() || undefined,
        status: "published",
      });
    }
    
    if (!isEditMode) {
      clearDraft(draftKey);
    }

    onOpenChange(false);
  };
  
  const isPending = createEvent.isPending || updateEvent.isPending;
  const isMultiDayType = eventType === "convention" || eventType === "tournament";
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Event" : "Create Event"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update the event details." 
              : isStandalone
                ? "Create a community event anyone can discover and join."
                : "Plan a game night, tournament, convention, or other event."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={`w-full grid mb-4 ${isStandalone ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="basics">Basics</TabsTrigger>
              <TabsTrigger value="venue">Venue</TabsTrigger>
              {isStandalone && <TabsTrigger value="location">Location</TabsTrigger>}
            </TabsList>
            
            <TabsContent value="basics" className="space-y-4 mt-0">
              {/* Event Type */}
              {!isEditMode && (
                <div className="space-y-2">
                  <Label>Event Type</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isStandalone ? "Board Game Meetup at Central Park" : "Game Night at Mike's"}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's planned for this event?"
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isMultiDayType ? "Start Date *" : "Date *"}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        disabled={isEditMode ? undefined : (d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="time">{isMultiDayType ? "Start Time *" : "Time *"}</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Multi-day end date */}
              {isMultiDayType && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "MMM d, yyyy") : "Pick end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          disabled={(d) => date ? d < date : false}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Visibility & Capacity */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  {isPublic ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium">{isPublic ? "Public Event" : "Private Event"}</p>
                    <p className="text-xs text-muted-foreground">
                      {isPublic 
                        ? isStandalone ? "Listed in the public events directory" : "Discoverable by non-members"
                        : "Only visible to library members"}
                    </p>
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
              
              <div className="space-y-2">
                <Label>Max Attendees</Label>
                <Input
                  type="number"
                  value={maxAttendees}
                  onChange={(e) => setMaxAttendees(e.target.value)}
                  placeholder="Unlimited"
                  min={1}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="venue" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Venue Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="e.g. Community Center, Mike's House"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={venueAddress || location}
                    onChange={(e) => { setVenueAddress(e.target.value); setLocation(e.target.value); }}
                    placeholder="Full address or directions"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Venue Notes</Label>
                <Textarea
                  value={venueNotes}
                  onChange={(e) => setVenueNotes(e.target.value)}
                  placeholder="e.g. Ring the doorbell, enter through side gate"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entry Fee</Label>
                  <Input
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    placeholder="Free / $5 / etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age Restriction</Label>
                  <Input
                    value={ageRestriction}
                    onChange={(e) => setAgeRestriction(e.target.value)}
                    placeholder="All ages / 18+ / etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Parking Info</Label>
                <Input
                  value={parkingInfo}
                  onChange={(e) => setParkingInfo(e.target.value)}
                  placeholder="Street parking, garage on 2nd Ave, etc."
                />
              </div>
            </TabsContent>

            {isStandalone && (
              <TabsContent value="location" className="space-y-4 mt-0">
                <p className="text-xs text-muted-foreground">
                  Adding location details helps people discover your event in our directory.
                </p>
                <div className="space-y-2">
                  <Label>City *</Label>
                  <Input
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    placeholder="e.g. Portland"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State / Region</Label>
                  <Input
                    value={locationRegion}
                    onChange={(e) => setLocationRegion(e.target.value)}
                    placeholder="e.g. Oregon"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={locationCountry}
                    onChange={(e) => setLocationCountry(e.target.value)}
                    placeholder="e.g. United States"
                  />
                </div>
              </TabsContent>
            )}
          </Tabs>
          
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim() || !date}>
              {isPending 
                ? (isEditMode ? "Saving..." : "Creating...") 
                : (isEditMode ? "Save Changes" : "Create Event")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}