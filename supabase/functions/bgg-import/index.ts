import { createClient } from "npm:@supabase/supabase-js@2";
import { logEvent } from "../_shared/system-logger.ts";

// ---------------------------------------------------------------------------
// Self-hosted detection: when running inside the main router, the game-import
// handler is passed in at import time to avoid the HTTP-proxy deadlock.
// ---------------------------------------------------------------------------
let _directGameImportHandler: ((req: Request) => Promise<Response>) | null = null;

/** Called by the main router to inject the game-import handler directly. */
export function setGameImportHandler(h: (req: Request) => Promise<Response>) {
  _directGameImportHandler = h;
}

// Helper to get allowed origins
const getAllowedOrigins = (): string[] => {
  const origins = [
    Deno.env.get("ALLOWED_ORIGIN") || "",
    "http://localhost:5173",
    "http://localhost:8080",
  ].filter(Boolean);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (supabaseUrl) {
    const projectMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (projectMatch) {
      origins.push(`https://${projectMatch[1]}.lovable.app`);
    }
  }

  return origins;
};

const getCorsHeaders = (requestOrigin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  const isAllowedOrigin =
    requestOrigin &&
    (allowedOrigins.some((allowed) => requestOrigin === allowed) ||
      requestOrigin.endsWith(".lovable.app") ||
      requestOrigin.endsWith(".lovableproject.com"));

  const origin = isAllowedOrigin ? requestOrigin : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
};

export default async function handler(req: Request): Promise<Response> {
  // If a direct handler was injected (self-hosted), delegate immediately.
  // This avoids the HTTP-proxy deadlock in the single-threaded edge-runtime.
  if (_directGameImportHandler) {
    return _directGameImportHandler(req);
  }

  // --- Cloud path: proxy via HTTP to game-import ---
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const url = body?.url;

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ success: false, error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!base || !anonKey) {
      return new Response(JSON.stringify({ success: false, error: "Backend not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = `${base}/functions/v1/game-import`;
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("BGG import proxy error:", error);
    return new Response(JSON.stringify({ success: false, error: "Import failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
