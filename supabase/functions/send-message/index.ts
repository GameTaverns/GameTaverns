import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit: max 5 messages per IP per hour
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_HOURS = 1;

interface MessageRequest {
  game_id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  turnstile_token: string;
}

// Verify Turnstile token with Cloudflare
async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secretKey) {
    console.error("Missing TURNSTILE_SECRET_KEY");
    return false;
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: ip,
      }),
    });

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}

// Email validation regex
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/i;

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("cf-connecting-ip") 
      || "unknown";

    // Parse and validate request body
    const body: MessageRequest = await req.json();
    const { game_id, sender_name, sender_email, message, turnstile_token } = body;

    // Validate required fields
    if (!game_id || !sender_name || !sender_email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "All fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify Turnstile CAPTCHA
    if (!turnstile_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Please complete the CAPTCHA verification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isTurnstileValid = await verifyTurnstileToken(turnstile_token, clientIp);
    if (!isTurnstileValid) {
      return new Response(
        JSON.stringify({ success: false, error: "CAPTCHA verification failed. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate lengths
    if (sender_name.trim().length === 0 || sender_name.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: "Name must be between 1 and 100 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (sender_email.length > 255 || !EMAIL_REGEX.test(sender_email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Please provide a valid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.trim().length === 0 || message.length > 2000) {
      return new Response(
        JSON.stringify({ success: false, error: "Message must be between 1 and 2000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate UUID format for game_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(game_id)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid game ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the game exists and is for sale
    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id, is_for_sale, title")
      .eq("id", game_id)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ success: false, error: "Game not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!game.is_for_sale) {
      return new Response(
        JSON.stringify({ success: false, error: "This game is not available for sale" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting check - count messages from this IP in the last hour
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW_HOURS);

    const { count, error: countError } = await supabaseAdmin
      .from("game_messages")
      .select("*", { count: "exact", head: true })
      .eq("sender_ip", clientIp)
      .gte("created_at", windowStart.toISOString());

    if (countError) {
      console.error("Rate limit check error:", countError);
    }

    if (count !== null && count >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Too many messages sent. Please try again later." 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the message
    const { data: insertedMessage, error: insertError } = await supabaseAdmin
      .from("game_messages")
      .insert({
        game_id,
        sender_name: sender_name.trim(),
        sender_email: sender_email.trim().toLowerCase(),
        message: message.trim(),
        sender_ip: clientIp,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send message. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Message sent for game "${game.title}" from ${sender_email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Message sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
