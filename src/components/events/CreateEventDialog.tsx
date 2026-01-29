import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, MapPin, Clock } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCreateEvent, useUpdateEvent, CalendarEvent } from "@/hooks/useLibraryEvents";
import { useDiscordNotify } from "@/hooks/useDiscordNotify";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryId: string;
  editEvent?: CalendarEvent | null;
}

export function CreateEventDialog({ open, onOpenChange, libraryId, editEvent }: CreateEventDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("19:00");
  const [location, setLocation] = useState("");
  
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const { notify } = useDiscordNotify();
  
  const isEditMode = !!editEvent;
  
  // Populate form when editing
  useEffect(() => {
    if (editEvent && open) {
      setTitle(editEvent.title);
      setDescription(editEvent.description || "");
      setLocation(editEvent.event_location || "");
      
      const eventDate = new Date(editEvent.event_date);
      setDate(eventDate);
      setTime(format(eventDate, "HH:mm"));
    } else if (!open) {
      // Reset form when dialog closes
      setTitle("");
      setDescription("");
      setDate(undefined);
      setTime("19:00");
      setLocation("");
    }
  }, [editEvent, open]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !date) return;
    
    // Combine date and time
    const [hours, minutes] = time.split(":").map(Number);
    const eventDate = new Date(date);
    eventDate.setHours(hours, minutes, 0, 0);
    
    if (isEditMode && editEvent) {
      // Update existing event
      await updateEvent.mutateAsync({
        eventId: editEvent.id,
        libraryId,
        updates: {
          title: title.trim(),
          description: description.trim() || null,
          event_date: eventDate.toISOString(),
          event_location: location.trim() || null,
        },
      });
    } else {
      // Create new event
      await createEvent.mutateAsync({
        library_id: libraryId,
        title: title.trim(),
        description: description.trim() || undefined,
        event_date: eventDate.toISOString(),
        event_location: location.trim() || undefined,
      });
      
      // Send Discord notification for new standalone event
      notify({
        library_id: libraryId,
        event_type: "event_created",
        data: {
          title: title.trim(),
          event_date: eventDate.toISOString(),
          event_location: location.trim() || null,
          description: description.trim() || null,
        },
      });
    }
    
    onOpenChange(false);
  };
  
  const isPending = createEvent.isPending || updateEvent.isPending;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Event" : "Create Event"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update the event details." 
              : "Add a standalone event to your library calendar."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Game Night at Mike's"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What games are you planning to play?"
              rows={2}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
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
              <Label htmlFor="time">Time *</Label>
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
          
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where is the event?"
                className="pl-9"
              />
            </div>
          </div>
          
          <DialogFooter>
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
