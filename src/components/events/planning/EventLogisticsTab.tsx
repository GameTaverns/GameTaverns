import { format } from "date-fns";
import { MapPin, DollarSign, Car, Users, Shield, Calendar, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EventDetail } from "@/hooks/useEventPlanning";

interface EventLogisticsTabProps {
  event: EventDetail;
}

export function EventLogisticsTab({ event }: EventLogisticsTabProps) {
  const eventDate = new Date(event.event_date);
  const endDate = event.end_date ? new Date(event.end_date) : null;

  return (
    <div className="space-y-4">
      {/* Description */}
      {event.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{event.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Date & Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Date & Time
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            <span className="font-medium">Start:</span>{" "}
            {format(eventDate, "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </div>
          {endDate && (
            <div className="text-sm">
              <span className="font-medium">End:</span>{" "}
              {format(endDate, "EEEE, MMMM d, yyyy 'at' h:mm a")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Venue & Location */}
      {(event.venue_name || event.venue_address || event.event_location) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Venue & Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {event.venue_name && (
              <div><span className="font-medium">Venue:</span> {event.venue_name}</div>
            )}
            {(event.venue_address || event.event_location) && (
              <div><span className="font-medium">Address:</span> {event.venue_address || event.event_location}</div>
            )}
            {event.venue_notes && (
              <div className="text-muted-foreground italic">{event.venue_notes}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Additional Info */}
      {(event.entry_fee || event.age_restriction || event.parking_info || event.max_attendees) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {event.entry_fee && (
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Entry Fee</p>
                    <p className="text-muted-foreground">{event.entry_fee}</p>
                  </div>
                </div>
              )}
              {event.max_attendees && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Capacity</p>
                    <p className="text-muted-foreground">{event.max_attendees} attendees</p>
                  </div>
                </div>
              )}
              {event.age_restriction && (
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Age Restriction</p>
                    <p className="text-muted-foreground">{event.age_restriction}</p>
                  </div>
                </div>
              )}
              {event.parking_info && (
                <div className="flex items-start gap-2">
                  <Car className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Parking</p>
                    <p className="text-muted-foreground">{event.parking_info}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state if no logistics */}
      {!event.description && !event.venue_name && !event.venue_address && !event.event_location && !event.entry_fee && !event.age_restriction && !event.parking_info && !event.max_attendees && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No venue or logistics details yet</p>
            <p className="text-xs mt-1">Edit the event to add venue, fees, parking info, etc.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
