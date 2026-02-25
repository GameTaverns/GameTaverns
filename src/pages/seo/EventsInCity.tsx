import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { SEO } from "@/components/seo/SEO";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Users, ChevronRight, Globe, Trophy, Gamepad2, Ticket } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

const db = supabase as any;

function unslugify(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const EVENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  game_night: <Gamepad2 className="h-3.5 w-3.5" />,
  tournament: <Trophy className="h-3.5 w-3.5" />,
  convention: <Ticket className="h-3.5 w-3.5" />,
  meetup: <Users className="h-3.5 w-3.5" />,
  public_event: <Globe className="h-3.5 w-3.5" />,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  game_night: "Game Night",
  tournament: "Tournament",
  convention: "Convention",
  meetup: "Meetup",
  public_event: "Public Event",
};

export default function EventsInCity() {
  const { city } = useParams<{ city: string }>();
  const cityName = unslugify(city || "");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events-in-city", city],
    queryFn: async () => {
      if (!city) return [];
      const { data, error } = await db
        .from("public_event_directory")
        .select("*")
        .order("event_date", { ascending: true });

      if (error) throw error;

      return (data || []).filter((e: any) => {
        const eCitySlug = (e.location_city || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        return eCitySlug === city;
      });
    },
    enabled: !!city,
  });

  // Fetch all cities for interlinking
  const { data: allCities = [] } = useQuery({
    queryKey: ["all-event-cities"],
    queryFn: async () => {
      const { data, error } = await db
        .from("public_event_directory")
        .select("location_city, location_region, location_country");
      if (error) throw error;

      const cityMap = new Map<string, { city: string; region: string | null; count: number }>();
      (data || []).forEach((e: any) => {
        const slug = (e.location_city || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!slug) return;
        const existing = cityMap.get(slug);
        if (existing) existing.count++;
        else cityMap.set(slug, { city: e.location_city, region: e.location_region, count: 1 });
      });
      return [...cityMap.entries()].map(([slug, data]) => ({ slug, ...data })).sort((a, b) => b.count - a.count);
    },
  });

  const title = `Board Game Events in ${cityName}`;
  const description = `Find board game events, tournaments, conventions, and game nights in ${cityName}. Register, discover, and join your local gaming community.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `https://gametaverns.com/events/${city}`,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://gametaverns.com" },
        { "@type": "ListItem", position: 2, name: "Events", item: "https://gametaverns.com/events" },
        { "@type": "ListItem", position: 3, name: cityName, item: `https://gametaverns.com/events/${city}` },
      ],
    },
  };

  return (
    <Layout hideSidebar>
      <SEO
        title={title}
        description={description}
        canonical={`https://gametaverns.com/events/${city}`}
        jsonLd={jsonLd}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/events" className="hover:text-foreground">Events</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{cityName}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold">{title}</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">{description}</p>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold mb-2">No upcoming events in {cityName}</h2>
            <p className="text-muted-foreground mb-4">Be the first to create a board game event here!</p>
            <Link to="/events">
              <Button>Browse All Events</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3 mb-12">
            {events.map((event: any) => {
              const eventDate = new Date(event.event_date);
              const endDate = event.end_date ? new Date(event.end_date) : null;
              const locationParts = [
                event.venue_name || event.event_location,
                event.location_city,
                event.location_region,
              ].filter(Boolean);

              return (
                <Link key={event.id} to={`/event/${event.id}`}>
                  <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 w-14 text-center rounded-lg border bg-muted/50 p-2">
                          <div className="text-xs text-muted-foreground uppercase">{format(eventDate, "MMM")}</div>
                          <div className="text-xl font-bold">{format(eventDate, "d")}</div>
                          {endDate && (
                            <div className="text-[10px] text-muted-foreground">– {format(endDate, "d")}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-display font-bold text-sm">{event.title}</h2>
                            <Badge variant="outline" className="text-[10px] gap-1">
                              {EVENT_TYPE_ICONS[event.event_type]}
                              {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                            </Badge>
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
                              </span>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{event.description}</p>
                          )}
                          {event.organizer_name && (
                            <Badge variant="secondary" className="text-[10px] mt-2">
                              {event.library_id ? "Hosted by" : "Organized by"} {event.organizer_name}
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Other cities */}
        {allCities.length > 1 && (
          <div className="border-t border-border pt-8">
            <h2 className="font-display font-bold text-lg mb-4">Browse Events by City</h2>
            <div className="flex flex-wrap gap-2">
              {allCities.filter((c) => c.slug !== city).slice(0, 20).map((c) => (
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
    </Layout>
  );
}
