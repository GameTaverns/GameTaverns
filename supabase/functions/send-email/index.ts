// Note: We keep serve import for compatibility but export handler for self-hosted router
import { createClient } from "npm:@supabase/supabase-js@2";

// IMPORTANT (self-hosted): this module is imported by the main router.
// Any top-level dependency fetch failure can crash the whole functions service.
// So we lazy-load SMTP deps inside the handler.
// Using esm.sh instead of npm: to avoid Deno cache resolution issues with denomailer.
type SMTPClientCtor = new (options: any) => {
  send: (options: any) => Promise<void>;
  close: () => Promise<void>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromEmail?: string;  // Optional: library owner's email to use as From address
  fromName?: string;   // Optional: library owner's display name
}

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============================================
    // Authentication & Authorization Check
    // ============================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the JWT token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);

    if (claimsError || !claimsData?.user) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;

    // Check authorization: must be site admin OR library owner
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if site admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    
    const isSiteAdmin = !!roleData;
    
    // Check if library owner
    const { data: ownedLibrary } = await supabaseAdmin
      .from("libraries")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    
    const isLibraryOwner = !!ownedLibrary;

    if (!isSiteAdmin && !isLibraryOwner) {
      console.error("Access denied: user is neither admin nor library owner");
      return new Response(
        JSON.stringify({ success: false, error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // SMTP Configuration
    // ============================================
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM");
    const smtpFromName = Deno.env.get("SMTP_FROM_NAME") || "Ethan Sommerfeld";

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      console.error("Missing SMTP configuration");
      return new Response(
        JSON.stringify({ success: false, error: "Server email configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, subject, html, text, replyTo, fromEmail, fromName }: EmailRequest = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use deno.land/x import to avoid npm module resolution issues in self-hosted edge-runtime
    const { SMTPClient } = (await import("https://deno.land/x/denomailer@1.6.0/mod.ts")) as {
      SMTPClient: SMTPClientCtor;
    };

    // Create SMTP client with port-appropriate TLS settings:
    // - Port 465: Implicit TLS (SMTPS) - connection is encrypted from the start, auth required
    // - Port 587: STARTTLS required - start plain, upgrade to TLS before auth
    // - Port 25: Internal relay - NO authentication (trusted internal network)
    const implicitTls = smtpPort === 465;
    const isInternalRelay = smtpPort === 25;
    
    console.log(`SMTP config: host=${smtpHost}, port=${smtpPort}, implicitTls=${implicitTls}, isInternalRelay=${isInternalRelay}`);
    
    // Build connection config - skip auth for internal relay on port 25
    const connectionConfig: any = {
      hostname: smtpHost,
      port: smtpPort,
      tls: implicitTls,
    };
    
    // Only add auth for ports that expect it (465 and 587)
    if (!isInternalRelay) {
      connectionConfig.auth = {
        username: smtpUser,
        password: smtpPass,
      };
    }
    
    const client = new SMTPClient({
      connection: connectionConfig,
      debug: {
        log: true, // Enable for debugging
        encodeLB: false,
        // Port 25 (internal relay): allow unsecure, skip STARTTLS
        allowUnsecure: isInternalRelay,
        noStartTLS: isInternalRelay,
      },
    });

    // Determine the From address
    // If fromEmail is provided, try to use it (requires SMTP server to allow sending on behalf)
    // Most shared SMTP servers won't allow arbitrary From addresses, so we keep SMTP_FROM as envelope sender
    // and use fromEmail in the display name to show who it's from
    const displayName = fromName || smtpFromName;
    const actualFromEmail = fromEmail || smtpFrom;
    const fromAddress = `${displayName} <${actualFromEmail}>`;
    
    // Build email options with optional Reply-To header
    // Also include Reply-To pointing to the user's email so replies go to them
    const emailOptions: any = {
      from: fromAddress,
      to: to,
      subject: subject,
      content: text || "",
      html: html,
    };
    
    // Set Reply-To to ensure replies go to the sender
    // If explicit replyTo is provided, use that; otherwise use fromEmail
    const replyToAddress = replyTo || fromEmail;
    if (replyToAddress) {
      emailOptions.headers = {
        "Reply-To": replyToAddress,
      };
    }
    
    await client.send(emailOptions);

    await client.close();

    console.log(`Email sent to ${to}: ${subject} (by admin ${userId})`);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
