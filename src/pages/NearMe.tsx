import { useState, useMemo, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { MapPin, Navigation, Search, Library, Calendar, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMapLibraries,
  useMapEvents,
  useUserLocation,
  getDistanceMiles,
} from "@/hooks/useNearbyMap";

const NearMeMap = lazy(() => import("@/components/near-me/NearMeMap"));

// Error boundary to catch map initialization crashes
class MapErrorBoundary extends Component<{ children: ReactNode; fallbackText: string; fallbackDesc: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallbackText: string; fallbackDesc: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Map failed to load:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 rounded-lg gap-2 p-4 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">{this.props.fallbackText}</p>
          <p className="text-xs text-muted-foreground">{this.props.fallbackDesc}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function NearMe() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { location, loading: locLoading, error: locError, requestGeoLocation, searchLocation } = useUserLocation();
  const { data: libraries = [], isLoading: libLoading } = useMapLibraries();
  const { data: events = [], isLoading: evtLoading } = useMapEvents();
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"libraries" | "events">("libraries");
  const [radiusMiles, setRadiusMiles] = useState(100);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) searchLocation(searchQuery.trim());
  };

  const nearbyLibraries = useMemo(() => {
    if (location.source === "default") return libraries;
    return libraries
      .map((lib) => ({
        ...lib,
        distance: getDistanceMiles(location.lat, location.lng, lib.latitude, lib.longitude),
      }))
      .filter((lib) => lib.distance <= radiusMiles)
      .sort((a, b) => a.distance - b.distance);
  }, [libraries, location, radiusMiles]);

  const nearbyEvents = useMemo(() => {
    if (location.source === "default") return events;
    return events
      .map((evt) => ({
        ...evt,
        distance: getDistanceMiles(location.lat, location.lng, evt.latitude, evt.longitude),
      }))
      .filter((evt) => evt.distance <= radiusMiles)
      .sort((a, b) => a.distance - b.distance);
  }, [events, location, radiusMiles]);

  const isLoading = libLoading || evtLoading;

  return (
    <Layout hideSidebar>
      <SEO
        title="Board Game Libraries & Events Near You"
        description="Find board game libraries, cafés, and events near you. Browse collections, borrow games, and join local game nights."
        canonical="https://gametaverns.com/near-me"
      />

      <div className="container max-w-6xl mx-auto py-6 px-4 space-y-5">
        {/* Header */}
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-1" onClick={() => navigate("/directory")}>
            <ArrowLeft className="h-4 w-4" />
            {t('nearMe.backToDirectory')}
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            {t('nearMe.title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('nearMe.description')}
          </p>
        </div>

        {/* Location Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('nearMe.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Button type="submit" size="sm" disabled={locLoading}>
              {t('common.search')}
            </Button>
          </form>
          <Button
            variant="outline"
            size="sm"
            onClick={requestGeoLocation}
            disabled={locLoading}
            className="gap-1.5"
          >
            {locLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            {t('nearMe.useMyLocation')}
          </Button>
        </div>

        {locError && (
          <p className="text-sm text-destructive">{locError}</p>
        )}

        {location.source !== "default" && location.label && (
          <p className="text-xs text-muted-foreground">
            {t('nearMe.showingResultsNear')} <span className="font-medium">{location.label}</span>
          </p>
        )}

        {/* Section Switcher */}
        <div className="inline-flex rounded-md border border-border bg-muted p-1">
          <Button
            type="button"
            size="sm"
            variant={tab === "libraries" ? "default" : "ghost"}
            className="gap-1.5"
            onClick={() => setTab("libraries")}
          >
            <Library className="h-4 w-4" />
            {t('nearMe.librariesTab')} ({nearbyLibraries.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "events" ? "default" : "ghost"}
            className="gap-1.5"
            onClick={() => setTab("events")}
          >
            <Calendar className="h-4 w-4" />
            {t('nearMe.eventsTab')} ({nearbyEvents.length})
          </Button>
        </div>

        {/* Map */}
        <div className="mt-4 rounded-lg overflow-hidden border border-border" style={{ height: 420 }}>
          {isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <MapErrorBoundary fallbackText={t('nearMe.mapCouldNotLoad')} fallbackDesc={t('nearMe.browseListBelow')}>
              <Suspense fallback={<Skeleton className="w-full h-full" />}>
                <NearMeMap
                  location={location}
                  tab={tab}
                  nearbyLibraries={nearbyLibraries}
                  nearbyEvents={nearbyEvents}
                />
              </Suspense>
            </MapErrorBoundary>
          )}
        </div>

        {/* List */}
        {tab === "libraries" ? (
          <div className="mt-4 space-y-3">
            {nearbyLibraries.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Library className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">{t('nearMe.noLibrariesFound')}</p>
                  <p className="text-xs mt-1">
                    {location.source === "default"
                      ? t('nearMe.useLocationHint')
                      : t('nearMe.tryIncreasingRadius')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              nearbyLibraries.map((lib) => (
                <Card
                  key={lib.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate(`/${lib.slug}`)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    {lib.logo_url ? (
                      <img
                        src={lib.logo_url}
                        alt={lib.name}
                        className="h-12 w-12 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Library className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{lib.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {lib.location_city && (
                          <span>{[lib.location_city, lib.location_region].filter(Boolean).join(", ")}</span>
                        )}
                        {"distance" in lib && (
                          <Badge variant="outline" className="text-[10px]">
                            {(lib as any).distance.toFixed(1)} mi
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{lib.game_count} {t('common.games')}</span>
                        <span>{lib.follower_count} {t('common.followers')}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {nearbyEvents.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">{t('nearMe.noEventsFound')}</p>
                  <p className="text-xs mt-1">
                    {location.source === "default"
                      ? t('nearMe.useLocationHintEvents')
                      : t('nearMe.tryDifferentArea')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              nearbyEvents.map((evt) => (
                <Card
                  key={evt.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() =>
                    evt.library_id
                      ? navigate(`/event/${evt.id}`)
                      : navigate(`/events`)
                  }
                >
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="shrink-0 w-14 text-center rounded-lg border bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground uppercase">
                        {format(new Date(evt.event_date), "MMM")}
                      </div>
                      <div className="text-xl font-bold">
                        {format(new Date(evt.event_date), "d")}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{evt.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>
                          {format(new Date(evt.event_date), "EEE, h:mm a")}
                        </span>
                        {(evt.venue_name || evt.location_city) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[evt.venue_name, evt.location_city].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {"distance" in evt && (
                          <Badge variant="outline" className="text-[10px]">
                            {(evt as any).distance.toFixed(1)} mi
                          </Badge>
                        )}
                      </div>
                      {evt.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {evt.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
