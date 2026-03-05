import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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

/*
 * IMPORTANT: No Radix UI / shadcn components inside Popup!
 * Leaflet renders popups outside React's DOM tree, which causes
 * "r is not a function" crashes with Radix in production builds.
 * Use only plain HTML elements + inline styles here.
 */
export default function NearMeMap({ location, tab, nearbyLibraries, nearbyEvents }: NearMeMapProps) {
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
              <div style={{ fontSize: 13, minWidth: 180 }}>
                <p style={{ fontWeight: 600, margin: "0 0 4px" }}>{lib.name}</p>
                {lib.location_city && (
                  <p style={{ color: "#888", fontSize: 11, margin: "0 0 2px" }}>
                    {[lib.location_city, lib.location_region].filter(Boolean).join(", ")}
                  </p>
                )}
                <p style={{ fontSize: 11, margin: "0 0 4px" }}>{lib.game_count} games</p>
                {lib.distance != null && (
                  <p style={{ color: "#888", fontSize: 11, margin: "0 0 4px" }}>{lib.distance.toFixed(1)} miles away</p>
                )}
                <a
                  href={`/${lib.slug}`}
                  style={{ display: "block", textAlign: "center", padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 11, textDecoration: "none", color: "inherit", marginTop: 4 }}
                >
                  View Library
                </a>
              </div>
            </Popup>
          </Marker>
        ))}

      {tab === "events" &&
        nearbyEvents.map((evt) => (
          <Marker key={evt.id} position={[evt.latitude, evt.longitude]} icon={eventIcon}>
            <Popup>
              <div style={{ fontSize: 13, minWidth: 180 }}>
                <p style={{ fontWeight: 600, margin: "0 0 4px" }}>{evt.title}</p>
                <p style={{ color: "#888", fontSize: 11, margin: "0 0 2px" }}>
                  {format(new Date(evt.event_date), "EEE, MMM d 'at' h:mm a")}
                </p>
                {(evt.venue_name || evt.location_city) && (
                  <p style={{ fontSize: 11, margin: "0 0 2px" }}>
                    {[evt.venue_name, evt.location_city].filter(Boolean).join(", ")}
                  </p>
                )}
                {evt.distance != null && (
                  <p style={{ color: "#888", fontSize: 11, margin: 0 }}>{evt.distance.toFixed(1)} miles away</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
