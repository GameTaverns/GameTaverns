import { useState } from "react";
import { format, isPast, isToday } from "date-fns";
import { Calendar, MapPin, Vote, CalendarPlus, ExternalLink, Pencil, Trash2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUpcomingEvents, useDeleteEvent, CalendarEvent } from "@/hooks/useLibraryEvents";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import { Skeleton } from "@/components/ui/skeleton";

interface UpcomingEventsWidgetProps {
  libraryId: string;
  isOwner?: boolean;
  onCreateEvent?: () => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

function EventItem({ 
  event, 
  isOwner, 
  onEdit, 
  onDelete,
  onViewDetail,
}: { 
  event: CalendarEvent; 
  isOwner: boolean;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
  onViewDetail?: (event: CalendarEvent) => void;
}) {
  const { buildUrl } = useTenantUrl();
  const eventDate = new Date(event.event_date);
  const isEventToday = isToday(eventDate);
  const isPastEvent = isPast(eventDate);
  
  // Build poll URL if it's a poll event
  const pollUrl = event.event_type === "poll" && event.share_token 
    ? buildUrl(`/poll/${event.share_token}`)
    : null;
  
  // Handle both Cloud ("standalone") and self-hosted ("event") naming
  const isStandaloneEvent = event.event_type === "standalone" || event.event_type === "event";
  
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
      {/* Date Badge */}
      <div className={`flex flex-col items-center justify-center min-w-[48px] h-12 rounded-lg text-center ${
        isEventToday 
          ? "bg-primary text-primary-foreground" 
          : isPastEvent 
            ? "bg-muted-foreground/20 text-muted-foreground"
            : "bg-primary/10 text-primary"
      }`}>
        <span className="text-xs font-medium uppercase">
          {format(eventDate, "MMM")}
        </span>
        <span className="text-lg font-bold leading-none">
          {format(eventDate, "d")}
        </span>
      </div>
      
      {/* Event Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm truncate">{event.title}</h4>
          <div className="flex items-center gap-1 shrink-0">
            {event.event_type === "poll" && (
              <Badge variant="outline" className="text-xs">
                <Vote className="h-3 w-3 mr-1" />
                Poll
              </Badge>
            )}
            {isEventToday && (
              <Badge className="text-xs bg-primary">Today</Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(eventDate, "h:mm a")}
          </span>
          {event.event_location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3" />
              {event.event_location}
            </span>
          )}
        </div>
        
        {/* Poll Link */}
        {pollUrl && (
          <a 
            href={pollUrl} 
            className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
          >
            View Poll <ExternalLink className="h-3 w-3" />
          </a>
        )}
        
        {/* Owner Actions for standalone events */}
        {isOwner && isStandaloneEvent && (
          <div className="flex items-center gap-1 mt-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs"
              onClick={() => onViewDetail?.(event)}
            >
              <ArrowRight className="h-3 w-3 mr-1" />
              Plan
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs"
              onClick={() => onEdit?.(event)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => onDelete?.(event)}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function UpcomingEventsWidget({ 
  libraryId, 
  isOwner = false, 
  onCreateEvent,
  onEditEvent,
}: UpcomingEventsWidgetProps) {
  const { data: events, isLoading } = useUpcomingEvents(libraryId);
  const deleteEvent = useDeleteEvent();
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const navigate = useNavigate();
  
  const handleDelete = async () => {
    if (!eventToDelete) return;
    
    await deleteEvent.mutateAsync({
      eventId: eventToDelete.id,
      libraryId,
    });
    
    setEventToDelete(null);
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Upcoming Events
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Game nights & scheduled events
              </CardDescription>
            </div>
            {isOwner && onCreateEvent && (
              <Button variant="ghost" size="sm" onClick={onCreateEvent} className="h-8">
                <CalendarPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {events && events.length > 0 ? (
            <div className="space-y-2">
              {events.map((event) => (
                <EventItem 
                  key={event.id} 
                  event={event} 
                  isOwner={isOwner}
                  onEdit={onEditEvent}
                  onDelete={setEventToDelete}
                  onViewDetail={(e) => navigate(`/event/${e.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming events</p>
              {isOwner && (
                <p className="text-xs mt-1">
                  Create a Game Night poll or add a standalone event
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{eventToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEvent.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
