import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { format } from "date-fns";
import type { UserLocation, MapLibrary, MapEvent } from "@/hooks/useNearbyMap";

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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function NearMeMap({ location, tab, nearbyLibraries, nearbyEvents }: NearMeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialZoom = location.source === "default" ? 3 : 9;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [location.lng, location.lat],
      zoom: initialZoom,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [location.lat, location.lng, location.source]);

  // Update center when location changes
  useEffect(() => {
    if (!mapRef.current) return;
    const nextZoom = location.source === "default" ? 3 : 9;
    mapRef.current.flyTo({ center: [location.lng, location.lat], zoom: nextZoom });
  }, [location.lat, location.lng, location.source]);

  // Update markers
  useEffect(() => {
    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const map = mapRef.current;
    if (!map) return;

    if (tab === "libraries") {
      nearbyLibraries.forEach((lib) => {
        const cityRegion = [lib.location_city, lib.location_region].filter(Boolean).join(", ");
        const distanceText = lib.distance != null ? `<p style="color:#888;font-size:11px;margin:0 0 4px">${lib.distance.toFixed(1)} miles away</p>` : "";

        const popup = new maplibregl.Popup({ offset: 25, maxWidth: "240px" }).setHTML(`
          <div style="font-size:13px;min-width:180px">
            <p style="font-weight:600;margin:0 0 4px">${escapeHtml(lib.name)}</p>
            ${cityRegion ? `<p style="color:#888;font-size:11px;margin:0 0 2px">${escapeHtml(cityRegion)}</p>` : ""}
            <p style="font-size:11px;margin:0 0 4px">${lib.game_count} games</p>
            ${distanceText}
            <a href="/${encodeURIComponent(lib.slug)}" style="display:block;text-align:center;padding:4px 8px;border:1px solid #ccc;border-radius:4px;font-size:11px;text-decoration:none;color:inherit;margin-top:4px">
              View Library
            </a>
          </div>
        `);

        const el = document.createElement("div");
        el.style.width = "24px";
        el.style.height = "24px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#3b82f6";
        el.style.border = "3px solid #fff";
        el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
        el.style.cursor = "pointer";

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lib.longitude, lib.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    } else {
      nearbyEvents.forEach((evt) => {
        const eventDateText = format(new Date(evt.event_date), "EEE, MMM d 'at' h:mm a");
        const venueCity = [evt.venue_name, evt.location_city].filter(Boolean).join(", ");
        const distanceText = evt.distance != null ? `<p style="color:#888;font-size:11px;margin:0">${evt.distance.toFixed(1)} miles away</p>` : "";

        const popup = new maplibregl.Popup({ offset: 25, maxWidth: "240px" }).setHTML(`
          <div style="font-size:13px;min-width:180px">
            <p style="font-weight:600;margin:0 0 4px">${escapeHtml(evt.title)}</p>
            <p style="color:#888;font-size:11px;margin:0 0 2px">${escapeHtml(eventDateText)}</p>
            ${venueCity ? `<p style="font-size:11px;margin:0 0 2px">${escapeHtml(venueCity)}</p>` : ""}
            ${distanceText}
          </div>
        `);

        const el = document.createElement("div");
        el.style.width = "24px";
        el.style.height = "24px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#10b981";
        el.style.border = "3px solid #fff";
        el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
        el.style.cursor = "pointer";

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([evt.longitude, evt.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }
  }, [tab, nearbyLibraries, nearbyEvents]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
