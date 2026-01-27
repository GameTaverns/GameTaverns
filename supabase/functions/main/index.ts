// Main router for SELF-HOSTED deployments only
// In Lovable Cloud, each function is deployed independently and this is just a stub

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// For Lovable Cloud: This is a stub. Each function (bgg-lookup, wishlist, etc.) 
// is deployed independently and accessed directly via /functions/v1/{function-name}

// For Self-Hosted: The Docker container mounts all functions and uses dynamic routing
// via the edge-runtime's --main-service flag pointing to this file

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const functionName = pathParts[0];

  // In Cloud deployment, this stub shouldn't receive real traffic
  // Each function is called directly. This is just for self-hosted routing.
  return new Response(
    JSON.stringify({ 
      message: "This is the self-hosted router stub",
      note: "In Lovable Cloud, call functions directly at /functions/v1/{function-name}",
      requestedFunction: functionName || "(none)",
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

// For Lovable Cloud deployment
Deno.serve(handler);
