import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Geocode edge function
 * 
 * Modes:
 * 1. Single geocode: POST { city, region, country } → { lat, lng }
 * 2. Backfill: POST { backfill: "libraries" | "events" } → geocodes all records missing lat/lng
 * 
 * Uses OpenStreetMap Nominatim (free, 1 req/sec rate limit)
 */

async function geocodeLocation(
  city?: string,
  region?: string,
  country?: string
): Promise<{ lat: number; lng: number } | null> {
  const parts = [city, region, country].filter(Boolean);
  if (parts.length === 0) return null;

  const query = parts.join(", ");
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: { "User-Agent": "GameTaverns/1.0 (admin@gametaverns.com)" },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!data || data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Mode 1: Single geocode
    if (body.city || body.region || body.country) {
      const result = await geocodeLocation(body.city, body.region, body.country);
      return new Response(JSON.stringify(result || { error: "Not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: result ? 200 : 404,
      });
    }

    // Mode 2: Backfill
    if (body.backfill === "libraries") {
      const { data: libs, error } = await supabase
        .from("library_settings")
        .select("library_id, location_city, location_region, location_country")
        .is("latitude", null)
        .not("location_city", "is", null)
        .limit(50);

      if (error) throw error;

      let geocoded = 0;
      for (const lib of libs || []) {
        const result = await geocodeLocation(
          lib.location_city,
          lib.location_region,
          lib.location_country
        );
        if (result) {
          await supabase
            .from("library_settings")
            .update({ latitude: result.lat, longitude: result.lng })
            .eq("library_id", lib.library_id);
          geocoded++;
        }
        // Nominatim rate limit: 1 req/sec
        await new Promise((r) => setTimeout(r, 1100));
      }

      return new Response(
        JSON.stringify({ backfilled: geocoded, total: libs?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.backfill === "events") {
      const { data: events, error } = await supabase
        .from("library_events")
        .select("id, location_city, location_region, location_country, event_location")
        .is("latitude", null)
        .limit(50);

      if (error) throw error;

      let geocoded = 0;
      for (const evt of events || []) {
        // Try structured location first, fall back to free-text event_location
        const city = evt.location_city || evt.event_location;
        const result = await geocodeLocation(
          city,
          evt.location_region,
          evt.location_country
        );
        if (result) {
          await supabase
            .from("library_events")
            .update({ latitude: result.lat, longitude: result.lng })
            .eq("id", evt.id);
          geocoded++;
        }
        await new Promise((r) => setTimeout(r, 1100));
      }

      return new Response(
        JSON.stringify({ backfilled: geocoded, total: events?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Provide city/region/country or backfill mode" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (err) {
    console.error("Geocode error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
