import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { 
  ArrowLeft, Calendar, MapPin, Clock, Users, Gamepad2, 
  Package, LayoutGrid, Settings, Globe, Lock, Pencil,
  CheckCircle2, XCircle, Send, MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEventDetail, useUpdateEventDetail } from "@/hooks/useEventPlanning";
import { EventGamesTab } from "@/components/events/planning/EventGamesTab";
import { EventSuppliesTab } from "@/components/events/planning/EventSuppliesTab";
import { EventTablesTab } from "@/components/events/planning/EventTablesTab";
import { EventLogisticsTab } from "@/components/events/planning/EventLogisticsTab";
import { EventAttendeesTab } from "@/components/events/planning/EventAttendeesTab";
import { Skeleton } from "@/components/ui/skeleton";

const EVENT_TYPE_LABELS: Record<string, string> = {
  game_night: "Game Night",
  tournament: "Tournament",
  convention: "Convention",
  meetup: "Meetup",
  public_event: "Public Event",
};

const EVENT_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  published: "default",
  cancelled: "destructive",
  completed: "secondary",
};

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading } = useEventDetail(eventId);
  const updateEvent = useUpdateEventDetail();
  const [activeTab, setActiveTab] = useState("details");

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4 text-center">
        <p className="text-muted-foreground">Event not found</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  const eventDate = new Date(event.event_date);
  const isMultiDay = !!event.end_date;
  const endDate = event.end_date ? new Date(event.end_date) : null;

  const handleStatusChange = (newStatus: string) => {
    updateEvent.mutate({ eventId: event.id, updates: { status: newStatus } as any });
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <Badge variant={EVENT_STATUS_VARIANT[event.status] || "outline"}>
              {event.status}
            </Badge>
            {event.is_public ? (
              <Badge variant="secondary" className="gap-1">
                <Globe className="h-3 w-3" /> Public
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" /> Private
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
            </Badge>
          </div>
        </div>

        {/* Status / Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {event.status === "draft" && (
              <DropdownMenuItem onClick={() => handleStatusChange("published")}>
                <Send className="h-4 w-4 mr-2" /> Publish
              </DropdownMenuItem>
            )}
            {event.status === "published" && (
              <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Completed
              </DropdownMenuItem>
            )}
            {event.status !== "cancelled" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleStatusChange("cancelled")}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" /> Cancel Event
                </DropdownMenuItem>
              </>
            )}
            {event.status === "cancelled" && (
              <DropdownMenuItem onClick={() => handleStatusChange("draft")}>
                <Pencil className="h-4 w-4 mr-2" /> Reopen as Draft
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick Info Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>
                {format(eventDate, "EEE, MMM d, yyyy")}
                {isMultiDay && endDate && ` – ${format(endDate, "EEE, MMM d, yyyy")}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>{format(eventDate, "h:mm a")}</span>
            </div>
            {(event.venue_name || event.event_location) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{event.venue_name || event.event_location}</span>
              </div>
            )}
            {event.max_attendees && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>Max {event.max_attendees} attendees</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="details" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Details</span>
          </TabsTrigger>
          <TabsTrigger value="games" className="gap-1.5">
            <Gamepad2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Games</span>
          </TabsTrigger>
          <TabsTrigger value="attendees" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Attendees</span>
          </TabsTrigger>
          <TabsTrigger value="supplies" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Supplies</span>
          </TabsTrigger>
          <TabsTrigger value="tables" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tables</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <EventLogisticsTab event={event} />
        </TabsContent>
        <TabsContent value="games">
          <EventGamesTab eventId={event.id} libraryId={event.library_id} />
        </TabsContent>
        <TabsContent value="attendees">
          <EventAttendeesTab eventId={event.id} />
        </TabsContent>
        <TabsContent value="supplies">
          <EventSuppliesTab eventId={event.id} />
        </TabsContent>
        <TabsContent value="tables">
          <EventTablesTab eventId={event.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
