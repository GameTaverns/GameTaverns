import { useState, useMemo, useEffect, useRef } from "react";
import { MapPin, Navigation, Search, Library, Calendar, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMapLibraries,
  useMapEvents,
  useUserLocation,
  getDistanceMiles,
  type MapLibrary,
  type MapEvent,
} from "@/hooks/useNearbyMap";

// Fix Leaflet default marker icons (broken in bundlers)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const libraryIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "hue-rotate-[200deg] saturate-150",
});

const eventIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "hue-rotate-[120deg] saturate-150",
});

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function NearMe() {
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

  const markers = tab === "libraries" ? nearbyLibraries : nearbyEvents;
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Near Me
          </h1>
          <p className="text-muted-foreground text-sm">
            Discover board game libraries and events in your area
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
                placeholder="Search city, zip code, or address..."
                className="pl-9"
              />
            </div>
            <Button type="submit" size="sm" disabled={locLoading}>
              Search
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
            Use My Location
          </Button>
        </div>

        {locError && (
          <p className="text-sm text-destructive">{locError}</p>
        )}

        {location.source !== "default" && location.label && (
          <p className="text-xs text-muted-foreground">
            Showing results near <span className="font-medium">{location.label}</span>
          </p>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="libraries" className="gap-1.5">
              <Library className="h-4 w-4" />
              Libraries ({nearbyLibraries.length})
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              Events ({nearbyEvents.length})
            </TabsTrigger>
          </TabsList>

          {/* Map */}
          <div className="mt-4 rounded-lg overflow-hidden border border-border" style={{ height: 420 }}>
            {isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <MapContainer
                center={[location.lat, location.lng]}
                zoom={location.source === "default" ? 4 : 10}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RecenterMap lat={location.lat} lng={location.lng} />

                {tab === "libraries" &&
                  nearbyLibraries.map((lib) => (
                    <Marker
                      key={lib.id}
                      position={[lib.latitude, lib.longitude]}
                      icon={libraryIcon}
                    >
                      <Popup>
                        <div className="text-sm space-y-1 min-w-[180px]">
                          <p className="font-semibold">{lib.name}</p>
                          {lib.location_city && (
                            <p className="text-muted-foreground text-xs">
                              {[lib.location_city, lib.location_region].filter(Boolean).join(", ")}
                            </p>
                          )}
                          <p className="text-xs">{lib.game_count} games</p>
                          {"distance" in lib && (
                            <p className="text-xs text-muted-foreground">
                              {(lib as any).distance.toFixed(1)} miles away
                            </p>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-1 text-xs"
                            onClick={() => navigate(`/${lib.slug}`)}
                          >
                            View Library
                          </Button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                {tab === "events" &&
                  nearbyEvents.map((evt) => (
                    <Marker
                      key={evt.id}
                      position={[evt.latitude, evt.longitude]}
                      icon={eventIcon}
                    >
                      <Popup>
                        <div className="text-sm space-y-1 min-w-[180px]">
                          <p className="font-semibold">{evt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(evt.event_date), "EEE, MMM d 'at' h:mm a")}
                          </p>
                          {(evt.venue_name || evt.location_city) && (
                            <p className="text-xs">
                              {[evt.venue_name, evt.location_city].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {"distance" in evt && (
                            <p className="text-xs text-muted-foreground">
                              {(evt as any).distance.toFixed(1)} miles away
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            )}
          </div>

          {/* List */}
          <TabsContent value="libraries" className="mt-4 space-y-3">
            {nearbyLibraries.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Library className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No libraries found nearby</p>
                  <p className="text-xs mt-1">
                    {location.source === "default"
                      ? "Use your location or search a city to find nearby libraries"
                      : "Try increasing your search radius or searching a different area"}
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
                        <span>{lib.game_count} games</span>
                        <span>{lib.follower_count} followers</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-4 space-y-3">
            {nearbyEvents.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No upcoming events found nearby</p>
                  <p className="text-xs mt-1">
                    {location.source === "default"
                      ? "Use your location or search a city to find nearby events"
                      : "Check back later or try a different area"}
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
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
