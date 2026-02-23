import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Download, ExternalLink, MapPin, PartyPopper, Clock } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo/SEO";
import { supabase } from "@/integrations/backend/client";
import { useTenant } from "@/contexts/TenantContext";
import { downloadICS, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Poll } from "@/hooks/usePolls";

/** Fetch all game night polls for the current library */
function useGameNights(libraryId: string | null) {
  return useQuery({
    queryKey: ["game-nights-calendar", libraryId],
    queryFn: async () => {
      if (!libraryId) return [];
      const { data, error } = await supabase
        .from("game_polls")
        .select("*")
        .eq("library_id", libraryId)
        .eq("poll_type", "game_night")
        .not("event_date", "is", null)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data as Poll[];
    },
    enabled: !!libraryId,
  });
}

function pollToCalendarEvent(poll: Poll): CalendarEvent {
  return {
    title: `🎲 ${poll.title}`,
    description: poll.description || `Game Night — ${poll.title}`,
    location: poll.event_location || undefined,
    startDate: new Date(poll.event_date!),
    allDay: !poll.event_date?.includes("T"),
  };
}

export default function GameCalendar() {
  const { library } = useTenant();
  const { data: nights = [], isLoading } = useGameNights(library?.id || null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start to begin on Sunday
  const startDay = monthStart.getDay();
  const paddedDays: (Date | null)[] = [
    ...Array(startDay).fill(null),
    ...days,
  ];

  const eventsThisMonth = useMemo(
    () => nights.filter((n) => n.event_date && isSameMonth(new Date(n.event_date), currentMonth)),
    [nights, currentMonth]
  );

  const upcoming = useMemo(
    () => nights.filter((n) => n.event_date && new Date(n.event_date) >= new Date()).slice(0, 5),
    [nights]
  );

  const getEventsForDay = (day: Date) =>
    nights.filter((n) => n.event_date && isSameDay(new Date(n.event_date), day));

  return (
    <Layout>
      <SEO
        title={`Game Nights — ${library?.name || "Calendar"}`}
        description={`Upcoming game nights and events${library ? ` at ${library.name}` : ""}. RSVP, add to your calendar, and never miss a session.`}
      />

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2 mb-6">
          <CalIcon className="h-6 w-6 text-primary" />
          Game Night Calendar
        </h1>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Calendar grid */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-4">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg">{format(currentMonth, "MMMM yyyy")}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-px mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-px">
                {paddedDays.map((day, i) => {
                  if (!day) return <div key={`pad-${i}`} className="h-16" />;
                  const dayEvents = getEventsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "h-16 p-1 rounded-md border border-transparent transition-colors",
                        isToday && "border-primary/50 bg-primary/5",
                        dayEvents.length > 0 && "bg-secondary/10"
                      )}
                    >
                      <span className={cn(
                        "text-xs",
                        isToday && "font-bold text-primary"
                      )}>
                        {format(day, "d")}
                      </span>
                      {dayEvents.slice(0, 2).map((evt) => (
                        <div
                          key={evt.id}
                          className="text-[9px] leading-tight truncate bg-primary/20 text-primary rounded px-1 mt-0.5"
                          title={evt.title}
                        >
                          {evt.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 2} more</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming events sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PartyPopper className="h-4 w-4 text-primary" />
                  Upcoming Events
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : upcoming.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No upcoming game nights scheduled.</p>
                ) : (
                  upcoming.map((night) => (
                    <EventCard key={night.id} poll={night} />
                  ))
                )}
              </CardContent>
            </Card>

            {eventsThisMonth.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    {eventsThisMonth.length} event{eventsThisMonth.length !== 1 ? "s" : ""} this month
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function EventCard({ poll }: { poll: Poll }) {
  const event = pollToCalendarEvent(poll);
  const isPast = new Date(poll.event_date!) < new Date();

  return (
    <div className={cn("border rounded-lg p-3 space-y-2", isPast && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{poll.title}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <Clock className="h-3 w-3 shrink-0" />
            {format(new Date(poll.event_date!), "PPp")}
          </div>
          {poll.event_location && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {poll.event_location}
            </div>
          )}
        </div>
        <Badge variant={isPast ? "secondary" : "default"} className="text-[10px] shrink-0">
          {isPast ? "Past" : poll.status}
        </Badge>
      </div>

      {!isPast && (
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-2"
            onClick={() => downloadICS(event)}
          >
            <Download className="h-3 w-3 mr-1" />
            .ics
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-2"
            asChild
          >
            <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              Google Cal
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
