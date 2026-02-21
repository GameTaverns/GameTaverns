/**
 * Pre-login check edge function.
 * Called before the actual Supabase auth login to:
 * 1. Check account lockout status
 * 2. Record login attempts (success/failure tracked after auth)
 * 
 * POST /check-login
 * Body: { email: string, action: "pre_check" | "record_success" | "record_failure" }
 */

import { withLogging } from "../_shared/system-logger.ts";
import { logAudit, recordLoginAttempt, isAccountLocked, getClientIp } from "../_shared/audit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, action, userId } = await req.json();
    const ip = getClientIp(req);

    if (!email || !action) {
      return new Response(JSON.stringify({ error: "Missing email or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "pre_check") {
      const locked = await isAccountLocked(email);
      if (locked) {
        await logAudit({
          action: "login_locked",
          details: { email: email.toLowerCase() },
          ipAddress: ip,
        });
        return new Response(
          JSON.stringify({
            locked: true,
            message: "Account temporarily locked due to too many failed login attempts. Please try again in 15 minutes.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      return new Response(JSON.stringify({ locked: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "record_success") {
      await recordLoginAttempt(email, true, ip);
      await logAudit({
        userId,
        action: "login_success",
        details: { email: email.toLowerCase() },
        ipAddress: ip,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "record_failure") {
      await recordLoginAttempt(email, false, ip);
      await logAudit({
        action: "login_failed",
        details: { email: email.toLowerCase() },
        ipAddress: ip,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export default withLogging("check-login", handler);

if (import.meta.main) {
  Deno.serve(withLogging("check-login", handler));
}
