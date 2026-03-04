import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";

export interface MapLibrary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  latitude: number;
  longitude: number;
  location_city: string | null;
  location_region: string | null;
  location_country: string | null;
  game_count: number;
  follower_count: number;
  member_count: number;
}

export interface MapEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_location: string | null;
  latitude: number;
  longitude: number;
  location_city: string | null;
  location_region: string | null;
  venue_name: string | null;
  library_id: string | null;
  event_type: string;
}

export function useMapLibraries() {
  return useQuery({
    queryKey: ["map-libraries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_directory")
        .select("id, name, slug, description, logo_url, latitude, longitude, location_city, location_region, location_country, game_count, follower_count, member_count")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return (data || []) as MapLibrary[];
    },
  });
}

export function useMapEvents() {
  return useQuery({
    queryKey: ["map-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_calendar_events")
        .select("id, title, description, event_date, event_location, latitude, longitude, location_city, location_region, venue_name, library_id, event_type")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true });
      if (error) throw error;
      return (data || []) as MapEvent[];
    },
  });
}

export interface UserLocation {
  lat: number;
  lng: number;
  source: "gps" | "search" | "default";
  label?: string;
}

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation>({
    lat: 39.8283,
    lng: -98.5795,
    source: "default",
    label: "United States",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestGeoLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "gps",
          label: "Your Location",
        });
        setLoading(false);
      },
      (err) => {
        setError("Unable to get your location. Try searching by city instead.");
        setLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }, []);

  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=1`,
        { headers: { "User-Agent": "GameTaverns/1.0" } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setLocation({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          source: "search",
          label: data[0].display_name?.split(",").slice(0, 2).join(",") || query,
        });
      } else {
        setError("Location not found. Try a different city or zip code.");
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, loading, error, requestGeoLocation, searchLocation };
}

/**
 * Calculate distance in miles between two points using Haversine formula
 */
export function getDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
