// Main entry point for self-hosted Supabase Edge Functions
// This router dispatches requests to individual functions

const FUNCTIONS: Record<string, string> = {
  "bgg-import": "./bgg-import",
  "bgg-lookup": "./bgg-lookup",
  "decrypt-messages": "./decrypt-messages",
  "game-import": "./game-import",
  "image-proxy": "./image-proxy",
  "send-email": "./send-email",
  "send-message": "./send-message",
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Expected path: /functionName or /functionName/...
  const functionName = pathParts[0];
  
  if (!functionName) {
    return new Response(
      JSON.stringify({ error: "Function name required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!FUNCTIONS[functionName]) {
    return new Response(
      JSON.stringify({ error: `Unknown function: ${functionName}` }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Import and execute the function dynamically
  try {
    const modulePath = `/home/deno/functions/${functionName}/index.ts`;
    const module = await import(modulePath);
    
    // If the module exports a default handler, use it
    if (typeof module.default === "function") {
      return module.default(req);
    }
    
    return new Response(
      JSON.stringify({ error: "Function does not export a handler" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`Error loading function ${functionName}:`, error);
    return new Response(
      JSON.stringify({ error: `Failed to load function: ${functionName}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
