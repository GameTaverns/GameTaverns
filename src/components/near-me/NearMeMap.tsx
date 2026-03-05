import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";
import type { UserLocation, MapLibrary, MapEvent } from "@/hooks/useNearbyMap";

// Fix Leaflet default marker icons
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

interface NearMeMapProps {
  location: UserLocation;
  tab: "libraries" | "events";
  nearbyLibraries: (MapLibrary & { distance?: number })[];
  nearbyEvents: (MapEvent & { distance?: number })[];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function NearMeMap({ location, tab, nearbyLibraries, nearbyEvents }: NearMeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialZoom = location.source === "default" ? 4 : 10;
    const map = L.map(containerRef.current, {
      center: [location.lat, location.lng],
      zoom: initialZoom,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    markersLayerRef.current = markersLayer;

    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, [location.lat, location.lng, location.source]);

  useEffect(() => {
    if (!mapRef.current) return;
    const nextZoom = location.source === "default" ? 4 : 10;
    mapRef.current.setView([location.lat, location.lng], nextZoom);
  }, [location.lat, location.lng, location.source]);

  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!markersLayer) return;

    markersLayer.clearLayers();

    if (tab === "libraries") {
      nearbyLibraries.forEach((lib) => {
        const cityRegion = [lib.location_city, lib.location_region].filter(Boolean).join(", ");
        const distanceText = lib.distance != null ? `<p style="color:#888;font-size:11px;margin:0 0 4px">${lib.distance.toFixed(1)} miles away</p>` : "";

        const popup = `
          <div style="font-size:13px;min-width:180px">
            <p style="font-weight:600;margin:0 0 4px">${escapeHtml(lib.name)}</p>
            ${cityRegion ? `<p style="color:#888;font-size:11px;margin:0 0 2px">${escapeHtml(cityRegion)}</p>` : ""}
            <p style="font-size:11px;margin:0 0 4px">${lib.game_count} games</p>
            ${distanceText}
            <a href="/${encodeURIComponent(lib.slug)}" style="display:block;text-align:center;padding:4px 8px;border:1px solid #ccc;border-radius:4px;font-size:11px;text-decoration:none;color:inherit;margin-top:4px">
              View Library
            </a>
          </div>
        `;

        L.marker([lib.latitude, lib.longitude], { icon: libraryIcon }).bindPopup(popup).addTo(markersLayer);
      });
    } else {
      nearbyEvents.forEach((evt) => {
        const eventDateText = format(new Date(evt.event_date), "EEE, MMM d 'at' h:mm a");
        const venueCity = [evt.venue_name, evt.location_city].filter(Boolean).join(", ");
        const distanceText = evt.distance != null ? `<p style="color:#888;font-size:11px;margin:0">${evt.distance.toFixed(1)} miles away</p>` : "";

        const popup = `
          <div style="font-size:13px;min-width:180px">
            <p style="font-weight:600;margin:0 0 4px">${escapeHtml(evt.title)}</p>
            <p style="color:#888;font-size:11px;margin:0 0 2px">${escapeHtml(eventDateText)}</p>
            ${venueCity ? `<p style="font-size:11px;margin:0 0 2px">${escapeHtml(venueCity)}</p>` : ""}
            ${distanceText}
          </div>
        `;

        L.marker([evt.latitude, evt.longitude], { icon: eventIcon }).bindPopup(popup).addTo(markersLayer);
      });
    }
  }, [tab, nearbyLibraries, nearbyEvents]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}

