import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import type { UserLocation, MapLibrary, MapEvent } from "@/hooks/useNearbyMap";

// Fix Leaflet default marker icons
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

interface NearMeMapProps {
  location: UserLocation;
  tab: "libraries" | "events";
  nearbyLibraries: (MapLibrary & { distance?: number })[];
  nearbyEvents: (MapEvent & { distance?: number })[];
}

export default function NearMeMap({ location, tab, nearbyLibraries, nearbyEvents }: NearMeMapProps) {
  const navigate = useNavigate();

  return (
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
          <Marker key={lib.id} position={[lib.latitude, lib.longitude]} icon={libraryIcon}>
            <Popup>
              <div className="text-sm space-y-1 min-w-[180px]">
                <p className="font-semibold">{lib.name}</p>
                {lib.location_city && (
                  <p className="text-muted-foreground text-xs">
                    {[lib.location_city, lib.location_region].filter(Boolean).join(", ")}
                  </p>
                )}
                <p className="text-xs">{lib.game_count} games</p>
                {lib.distance != null && (
                  <p className="text-xs text-muted-foreground">{lib.distance.toFixed(1)} miles away</p>
                )}
                <Button size="sm" variant="outline" className="w-full mt-1 text-xs" onClick={() => navigate(`/${lib.slug}`)}>
                  View Library
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}

      {tab === "events" &&
        nearbyEvents.map((evt) => (
          <Marker key={evt.id} position={[evt.latitude, evt.longitude]} icon={eventIcon}>
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
                {evt.distance != null && (
                  <p className="text-xs text-muted-foreground">{evt.distance.toFixed(1)} miles away</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
