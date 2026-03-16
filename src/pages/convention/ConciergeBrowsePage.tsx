import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/backend/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dice5, MapPin, CalendarDays, ArrowLeft, Gamepad2, Users } from "lucide-react";
import { format } from "date-fns";

/**
 * Browse page listing all active public conventions with direct concierge links.
 * Route: /concierge
 */
export default function ConciergeBrowsePage() {
  const navigate = useNavigate();

  const { data: conventions = [], isLoading } = useQuery({
    queryKey: ["public-conventions-concierge"],
    queryFn: async () => {
      // Get all convention events that are linked to public library events
      const { data, error } = await supabase
        .from("convention_events")
        .select(`
          id,
          club_id,
          lending_enabled,
          event:library_events!convention_events_event_id_fkey(
            id, title, description, event_date, end_date, venue_name, venue_address,
            is_public, status,
            library:libraries!library_events_library_id_fkey(id, name, slug)
          ),
          club:clubs(id, name, slug, logo_url)
        `)
        .eq("lending_enabled", true);

      if (error) throw error;

      // Filter to only public, active events
      return (data || []).filter((ce: any) => {
        const ev = ce.event;
        if (!ev) return false;
        if (!ev.is_public) return false;
        if (ev.status === "cancelled") return false;
        return true;
      }).sort((a: any, b: any) => {
        // Sort by event date, upcoming first
        const dateA = new Date(a.event.event_date).getTime();
        const dateB = new Date(b.event.event_date).getTime();
        return dateA - dateB;
      });
    },
  });

  const now = new Date();

  const activeConventions = conventions.filter((ce: any) => {
    const endDate = ce.event.end_date ? new Date(ce.event.end_date) : new Date(ce.event.event_date);
    // Include events that haven't ended yet (with 1 day buffer)
    endDate.setDate(endDate.getDate() + 1);
    return endDate >= now;
  });

  const pastConventions = conventions.filter((ce: any) => {
    const endDate = ce.event.end_date ? new Date(ce.event.end_date) : new Date(ce.event.event_date);
    endDate.setDate(endDate.getDate() + 1);
    return endDate < now;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6 w-full flex-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
              <Dice5 className="h-6 w-6 text-primary" />
              Game Concierge
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse games at active conventions · Find and reserve your next play
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading conventions...</div>
          </div>
        )}

        {!isLoading && activeConventions.length === 0 && pastConventions.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Dice5 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Active Conventions</h3>
              <p className="text-sm text-muted-foreground">
                There are no convention events with lending enabled right now. Check back later!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Active Conventions */}
        {activeConventions.length > 0 && (
          <div className="space-y-4 mb-8">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" />
              Active Conventions
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {activeConventions.map((ce: any) => (
                <ConventionCard
                  key={ce.id}
                  convention={ce}
                  onOpen={() => navigate(`/convention/${ce.event.id}/concierge`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Past Conventions */}
        {pastConventions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
              Past Conventions
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 opacity-60">
              {pastConventions.map((ce: any) => (
                <ConventionCard
                  key={ce.id}
                  convention={ce}
                  isPast
                  onOpen={() => navigate(`/convention/${ce.event.id}/concierge`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function ConventionCard({ convention, isPast, onOpen }: { convention: any; isPast?: boolean; onOpen: () => void }) {
  const ev = convention.event;
  const clubName = convention.club?.name;
  const libraryName = ev.library?.name;
  const contextName = clubName || libraryName || "Unknown";

  const eventDate = ev.event_date ? format(new Date(ev.event_date), "MMM d, yyyy") : "TBD";
  const endDate = ev.end_date ? format(new Date(ev.end_date), "MMM d, yyyy") : null;
  const dateDisplay = endDate && endDate !== eventDate ? `${eventDate} – ${endDate}` : eventDate;

  return (
    <Card className="border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{ev.title}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {contextName}
            </p>
          </div>
          {convention.club?.logo_url && (
            <img
              src={convention.club.logo_url}
              alt=""
              className="w-10 h-10 rounded-lg object-cover shrink-0"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {dateDisplay}
          </span>
          {ev.venue_name && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {ev.venue_name}
            </span>
          )}
        </div>

        {ev.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{ev.description}</p>
        )}

        <Button
          onClick={onOpen}
          size="sm"
          className="w-full gap-2"
          variant={isPast ? "outline" : "default"}
        >
          <Dice5 className="h-4 w-4" />
          {isPast ? "View Games" : "Browse & Reserve Games"}
        </Button>
      </CardContent>
    </Card>
  );
}
