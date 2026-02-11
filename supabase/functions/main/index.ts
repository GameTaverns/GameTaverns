// Main router for self-hosted deployments
// ARCHITECTURE: This is a thin dispatcher that lazy-imports all handlers on demand.
// Uses string-literal dynamic imports because edge-runtime's --main-service sandbox
// blocks variable-path imports. External handler directories must be physically
// present inside main/ (copied by update.sh's sync step).
// For Lovable Cloud, each function is deployed independently.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Handler cache: once a module is dynamically imported, we keep the reference
const handlerCache = new Map<string, (req: Request) => Promise<Response> | Response>();

// Each import MUST be a string literal for edge-runtime sandbox compatibility.
// Variable-path imports (e.g. import(someVar)) are blocked by the sandbox.
const EXTERNAL_IMPORTERS: Record<string, () => Promise<{ default: (req: Request) => Promise<Response> | Response }>> = {
  "bgg-lookup":             () => import("./bgg-lookup/index.ts"),
  "bgg-play-import":        () => import("./bgg-play-import/index.ts"),
  "bgg-sync":               () => import("./bgg-sync/index.ts"),
  "bgg-sync-cron":          () => import("./bgg-sync-cron/index.ts"),
  "bulk-import":            () => import("./bulk-import/index.ts"),
  "clubs":                  () => import("./clubs/index.ts"),
  "verify-email":           () => import("./verify-email/index.ts"),
  "verify-reset-token":     () => import("./verify-reset-token/index.ts"),
  "send-auth-email":        () => import("./send-auth-email/index.ts"),
  "send-message":           () => import("./send-message/index.ts"),
  "my-inquiries":           () => import("./my-inquiries/index.ts"),
  "reply-to-inquiry":       () => import("./reply-to-inquiry/index.ts"),
  "send-inquiry-reply":     () => import("./send-inquiry-reply/index.ts"),
  "condense-descriptions":  () => import("./condense-descriptions/index.ts"),
  "decrypt-messages":       () => import("./decrypt-messages/index.ts"),
  "membership":             () => import("./membership/index.ts"),
  "library-settings":       () => import("./library-settings/index.ts"),
  "profile-update":         () => import("./profile-update/index.ts"),
  "notify-feedback":        () => import("./notify-feedback/index.ts"),
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
      import("./bgg-import/index.ts"),
      import("./game-import/index.ts"),
    ]);
    // Wire bgg-import to call game-import directly (avoids HTTP proxy deadlock)
    if (bggMod.setGameImportHandler) {
      bggMod.setGameImportHandler(gameMod.default);
    }
    handlerCache.set("bgg-import", bggMod.default);
    handlerCache.set("game-import", gameMod.default);
    return handlerCache.get(functionName)!;
  }

  // External handlers (string-literal imports via thunks)
  const importer = EXTERNAL_IMPORTERS[functionName];
  if (importer) {
    const mod = await importer();
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
  ...Object.keys(EXTERNAL_IMPORTERS),
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
