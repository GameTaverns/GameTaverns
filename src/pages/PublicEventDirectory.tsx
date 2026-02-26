import { useCallback, useState } from "react";
import { format } from "date-fns";
import { Search, Calendar, MapPin, Users, Globe, ChevronRight, Trophy, Gamepad2, Ticket, Filter, Plus, CalendarPlus } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicEventDirectory } from "@/hooks/useEventSchedule";
import { useAuth } from "@/hooks/useAuth";
import { CreateEventDialog } from "@/components/events/CreateEventDialog";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";

const EVENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  game_night: <Gamepad2 className="h-4 w-4" />,
  tournament: <Trophy className="h-4 w-4" />,
  convention: <Ticket className="h-4 w-4" />,
  meetup: <Users className="h-4 w-4" />,
  public_event: <Globe className="h-4 w-4" />,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  game_night: "Game Night",
  tournament: "Tournament",
  convention: "Convention",
  meetup: "Meetup",
  public_event: "Public Event",
};

const PUBLIC_EVENT_CREATE_DIALOG_KEY = "public_event_create_dialog_open";

export default function PublicEventDirectory() {
  const { data: events = [], isLoading } = usePublicEventDirectory();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("");
  const [showCreateDialog, setShowCreateDialogRaw] = useState(() => {
    try {
      return sessionStorage.getItem(PUBLIC_EVENT_CREATE_DIALOG_KEY) === "true";
    } catch {
      return false;
    }
  });
  const setShowCreateDialog = useCallback((open: boolean) => {
    setShowCreateDialogRaw(open);
    try {
      sessionStorage.setItem(PUBLIC_EVENT_CREATE_DIALOG_KEY, String(open));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Extract unique cities
  const cities = Array.from(new Set(
    events
      .map((e: any) => e.location_city)
      .filter(Boolean)
  )).sort() as string[];

  // Build city slugs for SEO links
  const cityLinks = Array.from(
    events.reduce((map: Map<string, { city: string; count: number }>, e: any) => {
      const city = e.location_city;
      if (!city) return map;
      const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const existing = map.get(slug);
      if (existing) existing.count++;
      else map.set(slug, { city, count: 1 });
      return map;
    }, new Map<string, { city: string; count: number }>())
  ).map(([slug, data]) => ({ slug, ...data })).sort((a, b) => b.count - a.count);

  const filtered = events.filter((e: any) => {
    const matchesSearch = !search ||
      e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.organizer_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.venue_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.location_city?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || e.event_type === typeFilter;
    const matchesCity = !cityFilter ||
      e.location_city?.toLowerCase().includes(cityFilter.toLowerCase());
    return matchesSearch && matchesType && matchesCity;
  });

  const title = "Board Game Events & Tournaments";
  const description = "Discover upcoming board game events, tournaments, conventions, and game nights near you. Register and join the community.";

  return (
    <Layout hideSidebar>
      <SEO title={title} description={description} canonical="https://gametaverns.com/events" />

      <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              Events Near You
            </h1>
            <p className="text-muted-foreground text-sm">
              Discover upcoming board game events, tournaments, and conventions
            </p>
          </div>
          {isAuthenticated && (
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-1.5">
              <CalendarPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Event</span>
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events, organizers..."
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="game_night">Game Nights</SelectItem>
              <SelectItem value="tournament">Tournaments</SelectItem>
              <SelectItem value="convention">Conventions</SelectItem>
              <SelectItem value="meetup">Meetups</SelectItem>
              <SelectItem value="public_event">Public Events</SelectItem>
            </SelectContent>
          </Select>
          {cities.length > 0 && (
            <div className="relative min-w-[160px]">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                placeholder="Filter by city..."
                className="pl-9"
                list="city-suggestions"
              />
              <datalist id="city-suggestions">
                {cities.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          )}
        </div>

        {/* Events List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No events found</p>
              <p className="text-xs mt-1">
                {search || typeFilter !== "all" || cityFilter
                  ? "Try adjusting your filters"
                  : "Check back later or create your own event!"}
              </p>
              {isAuthenticated && (
                <Button size="sm" variant="outline" className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  <CalendarPlus className="h-4 w-4 mr-1" /> Create Event
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((event: any) => (
              <EventDirectoryCard
                key={event.id}
                event={event}
                onClick={() => navigate(`/event/${event.id}`)}
              />
            ))}
          </div>
        )}

        {/* City Links for SEO */}
        {cityLinks.length > 0 && (
          <div className="border-t border-border pt-8 mt-8">
            <h2 className="font-display font-bold text-lg mb-4">Browse Events by City</h2>
            <div className="flex flex-wrap gap-2">
              {cityLinks.slice(0, 30).map((c) => (
                <Link
                  key={c.slug}
                  to={`/events/${c.slug}`}
                  className="px-3 py-1.5 rounded-full text-sm border border-border hover:border-primary hover:text-primary transition-colors bg-muted"
                >
                  {c.city} ({c.count})
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <CreateEventDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </Layout>
  );
}

function EventDirectoryCard({ event, onClick }: { event: any; onClick: () => void }) {
  const eventDate = new Date(event.event_date);
  const endDate = event.end_date ? new Date(event.end_date) : null;
  const isMultiDay = !!endDate;

  const locationParts = [
    event.venue_name || event.event_location,
    event.location_city,
    event.location_region,
  ].filter(Boolean);

  return (
    <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Date Block */}
          <div className="shrink-0 w-14 text-center rounded-lg border bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground uppercase">{format(eventDate, "MMM")}</div>
            <div className="text-xl font-bold">{format(eventDate, "d")}</div>
            {isMultiDay && endDate && (
              <div className="text-[10px] text-muted-foreground">– {format(endDate, "d")}</div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{event.title}</h3>
              <Badge variant="outline" className="text-[10px] gap-1">
                {EVENT_TYPE_ICONS[event.event_type]}
                {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
              </Badge>
              {!event.library_id && (
                <Badge variant="secondary" className="text-[10px]">Community</Badge>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(eventDate, "EEE, MMM d 'at' h:mm a")}
              </span>
              {locationParts.length > 0 && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {locationParts.join(", ")}
                </span>
              )}
              {event.registration_count > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {event.registration_count} registered
                  {event.max_attendees && ` / ${event.max_attendees}`}
                </span>
              )}
            </div>

            {event.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{event.description}</p>
            )}

            <div className="flex items-center gap-2 mt-2">
              {event.organizer_name && (
                <Badge variant="secondary" className="text-[10px]">
                  {event.library_id ? "Hosted by" : "Organized by"} {event.organizer_name}
                </Badge>
              )}
              {event.entry_fee && event.entry_fee !== "Free" && (
                <Badge variant="outline" className="text-[10px]">{event.entry_fee}</Badge>
              )}
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-2" />
        </div>
      </CardContent>
    </Card>
  );
}