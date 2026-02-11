// Main router for self-hosted deployments
// ARCHITECTURE: This is a thin dispatcher that lazy-imports all handlers on demand.
// This prevents the edge-runtime from compiling 3000+ lines at cold boot.
// Each handler is only compiled when its route is first requested.
// For Lovable Cloud, each function is deployed independently.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Handler cache: once a module is dynamically imported, we keep the reference
const handlerCache = new Map<string, (req: Request) => Promise<Response> | Response>();

// Map of function names to their dynamic import paths
// "external" = separate file under ../function-name/index.ts (has default export)
// "inlined"  = exported from ./handlers.ts
// Resolve sibling function paths as absolute file:// URLs
// (edge-runtime --main-service restricts relative dynamic imports)
function siblingUrl(name: string): string {
  return new URL(`../${name}/index.ts`, import.meta.url).href;
}

const EXTERNAL_HANDLERS: Record<string, string> = {
  "bgg-lookup": siblingUrl("bgg-lookup"),
  "bgg-play-import": siblingUrl("bgg-play-import"),
  "bgg-sync": siblingUrl("bgg-sync"),
  "bgg-sync-cron": siblingUrl("bgg-sync-cron"),
  "bulk-import": siblingUrl("bulk-import"),
  "clubs": siblingUrl("clubs"),
  "verify-email": siblingUrl("verify-email"),
  "verify-reset-token": siblingUrl("verify-reset-token"),
  "send-auth-email": siblingUrl("send-auth-email"),
  "send-message": siblingUrl("send-message"),
  "my-inquiries": siblingUrl("my-inquiries"),
  "reply-to-inquiry": siblingUrl("reply-to-inquiry"),
  "send-inquiry-reply": siblingUrl("send-inquiry-reply"),
  "condense-descriptions": siblingUrl("condense-descriptions"),
  "decrypt-messages": siblingUrl("decrypt-messages"),
  "membership": siblingUrl("membership"),
  "library-settings": siblingUrl("library-settings"),
  "profile-update": siblingUrl("profile-update"),
  "notify-feedback": siblingUrl("notify-feedback"),
};

// These are exported from handlers.ts by name
const INLINED_HANDLER_NAMES = [
  "totp-status", "totp-setup", "totp-verify", "totp-disable",
  "manage-users", "wishlist", "rate-game",
  "discord-config", "discord-unlink", "image-proxy", "manage-account",
  "refresh-images", "signup",
  "game-recommendations", "resolve-username", "sync-achievements",
  "discord-notify", "discord-create-event", "discord-forum-post",
  "discord-delete-thread", "discord-oauth-callback", "discord-send-dm",
];

// bgg-import and game-import need special wiring (deadlock prevention)
const BGG_GAME_IMPORT_NAMES = ["bgg-import", "game-import"];

// Convert "some-function" to "someFunction" for export lookup
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

async function getHandler(functionName: string): Promise<((req: Request) => Promise<Response> | Response) | null> {
  // Check cache first
  const cached = handlerCache.get(functionName);
  if (cached) return cached;

  // Special case: bgg-import and game-import need wiring
  if (BGG_GAME_IMPORT_NAMES.includes(functionName)) {
    const [bggMod, gameMod] = await Promise.all([
      import(siblingUrl("bgg-import")),
      import(siblingUrl("game-import")),
    ]);
    // Wire bgg-import to call game-import directly (avoids HTTP proxy deadlock)
    if (bggMod.setGameImportHandler) {
      bggMod.setGameImportHandler(gameMod.default);
    }
    handlerCache.set("bgg-import", bggMod.default);
    handlerCache.set("game-import", gameMod.default);
    return handlerCache.get(functionName)!;
  }

  // External handlers (separate files with default export)
  if (EXTERNAL_HANDLERS[functionName]) {
    const mod = await import(EXTERNAL_HANDLERS[functionName]);
    handlerCache.set(functionName, mod.default);
    return mod.default;
  }

  // Inlined handlers from handlers.ts
  if (INLINED_HANDLER_NAMES.includes(functionName)) {
    const handlers = await import("./handlers.ts");
    // Cache ALL inlined handlers at once since they're in one file
    for (const name of INLINED_HANDLER_NAMES) {
      const exportName = toCamelCase(name);
      if (handlers[exportName]) {
        handlerCache.set(name, handlers[exportName]);
      }
    }
    return handlerCache.get(functionName) || null;
  }

  return null;
}

const ALL_FUNCTIONS = [
  ...BGG_GAME_IMPORT_NAMES,
  ...Object.keys(EXTERNAL_HANDLERS),
  ...INLINED_HANDLER_NAMES,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const functionName = pathParts[0] === "main" ? pathParts[1] : pathParts[0];

  if (!functionName || functionName === "main") {
    return new Response(
      JSON.stringify({
        message: "Edge function router (self-hosted, lazy-loading)",
        available: ALL_FUNCTIONS,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const handler = await getHandler(functionName);
    if (handler) {
      return await handler(req);
    }
  } catch (err) {
    console.error(`[router] Error loading/executing ${functionName}:`, err);
    return new Response(
      JSON.stringify({ error: `Function "${functionName}" failed to load`, detail: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ error: "Function not found", function: functionName }),
    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
