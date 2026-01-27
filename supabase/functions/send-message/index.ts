// Note: We keep serve import for compatibility but export handler for self-hosted router
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

// AES-GCM encryption using Web Crypto API
async function encryptData(plaintext: string, keyHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Convert hex key to bytes
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  // Import the key
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Hash IP for rate limiting (we can't decrypt hashed IPs, but can compare)
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
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

// Enhanced email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// URL/link detection regex  
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
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

    // Block links in messages
    if (URL_REGEX.test(message)) {
      return new Response(
        JSON.stringify({ success: false, error: "Links are not allowed in messages" }),
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
    const encryptionKey = Deno.env.get("PII_ENCRYPTION_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!encryptionKey || encryptionKey.length !== 64) {
      console.error("Missing or invalid PII_ENCRYPTION_KEY (must be 64 hex chars for AES-256)");
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

    // Hash IP for rate limiting (allows comparison without storing plaintext)
    const hashedIp = await hashIP(clientIp);

    // Rate limiting check - count messages from this hashed IP in the last hour
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW_HOURS);

    const { count, error: countError } = await supabaseAdmin
      .from("game_messages")
      .select("*", { count: "exact", head: true })
      .eq("sender_ip_encrypted", hashedIp)
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

    // Encrypt PII fields and message content
    const encryptedName = await encryptData(sender_name.trim(), encryptionKey);
    const encryptedEmail = await encryptData(sender_email.trim().toLowerCase(), encryptionKey);
    const encryptedIp = await encryptData(clientIp, encryptionKey);
    const encryptedMessage = await encryptData(message.trim(), encryptionKey);

    // Insert the message with encrypted data only (no plaintext columns in table)
    const { data: insertedMessage, error: insertError } = await supabaseAdmin
      .from("game_messages")
      .insert({
        game_id,
        sender_name_encrypted: encryptedName,
        sender_email_encrypted: encryptedEmail,
        sender_ip_encrypted: encryptedIp,
        message_encrypted: encryptedMessage,
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

    console.log(`Message sent for game "${game.title}" (encrypted PII)`);

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
}

// For Lovable Cloud deployment (direct function invocation)
Deno.serve(handler);
